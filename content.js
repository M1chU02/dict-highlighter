(function () {
  const MARK_CLASS = "__dict_highlighter_mark__";
  const SKIP_TAGS = new Set([
    "SCRIPT",
    "STYLE",
    "NOSCRIPT",
    "TEXTAREA",
    "INPUT",
    "SELECT",
    "IFRAME",
  ]);

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function clearHighlights() {
    const marks = document.querySelectorAll("mark." + MARK_CLASS);
    marks.forEach((mark) => {
      const parent = mark.parentNode;
      if (!parent) return;
      // Replace the mark with its text content, then merge adjacent text nodes
      const textNode = document.createTextNode(mark.textContent);
      parent.replaceChild(textNode, mark);
      parent.normalize();
    });
  }

  function normalizeWord(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  function highlightWords(words, color, wholeWord) {
    clearHighlights();

    if (!words || words.length === 0) {
      return { count: 0, matches: [] };
    }

    const uniqueWords = [
      ...new Map(
        words.map((word) => [normalizeWord(word), String(word).trim()]),
      ).values(),
    ];

    // Longer phrases first, so substrings inside longer phrases don't get split first
    const sorted = [...uniqueWords].sort((a, b) => b.length - a.length);
    const escaped = sorted.map(escapeRegExp);
    const boundary = wholeWord ? "\\b" : "";
    const pattern = new RegExp(
      boundary + "(" + escaped.join("|") + ")" + boundary,
      "gi",
    );

    let count = 0;
    const matchedSet = new Set();

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (!node.nodeValue || !node.nodeValue.trim()) {
            return NodeFilter.FILTER_REJECT;
          }
          let el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          if (SKIP_TAGS.has(el.tagName)) return NodeFilter.FILTER_REJECT;
          if (el.closest && el.closest("." + MARK_CLASS))
            return NodeFilter.FILTER_REJECT;
          if (el.isContentEditable) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );

    const targets = [];
    let node;
    while ((node = walker.nextNode())) {
      pattern.lastIndex = 0;
      if (pattern.test(node.nodeValue)) {
        targets.push(node);
      }
    }

    targets.forEach((textNode) => {
      const text = textNode.nodeValue;
      pattern.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;
      let matchedAny = false;

      while ((match = pattern.exec(text)) !== null) {
        matchedAny = true;
        const start = match.index;
        const end = start + match[0].length;

        if (start > lastIndex) {
          frag.appendChild(
            document.createTextNode(text.slice(lastIndex, start)),
          );
        }

        const matchedWord = match[0].trim();
        const normalized = normalizeWord(matchedWord);
        const originalWord = uniqueWords.find(
          (word) => normalizeWord(word) === normalized,
        );
        if (originalWord) {
          matchedSet.add(originalWord);
        }

        const mark = document.createElement("mark");
        mark.className = MARK_CLASS;
        mark.style.backgroundColor = color || "#fff59d";
        mark.style.color = "#000";
        mark.style.padding = "0";
        mark.style.borderRadius = "2px";
        mark.textContent = match[0];
        frag.appendChild(mark);
        count++;

        lastIndex = end;

        if (match[0].length === 0) {
          pattern.lastIndex++;
        }
      }

      if (matchedAny) {
        if (lastIndex < text.length) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        }
        textNode.parentNode.replaceChild(frag, textNode);
      }
    });

    if (count > 0) {
      const first = document.querySelector("mark." + MARK_CLASS);
      if (first && first.scrollIntoView) {
        first.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }

    return { count, matches: [...matchedSet] };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "highlight") {
      const result = highlightWords(
        message.words,
        message.color,
        message.wholeWord,
      );
      sendResponse(result);
    } else if (message.action === "clear") {
      clearHighlights();
      sendResponse({ ok: true, count: 0, matches: [] });
    }
    return true;
  });
})();
