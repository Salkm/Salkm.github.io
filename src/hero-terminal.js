function readLines(code) {
  const lines = [[]];
  const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const type = node.parentElement === code ? '' : node.parentElement.className;
    node.textContent.split('\n').forEach((text, index) => {
      if (index) lines.push([]);
      if (text) lines.at(-1).push({ text, type });
    });
  }
  return lines;
}

export function createHeroTerminal(root, specialty, { reducedMotion = false } = {}) {
  const lines = readLines(root.querySelector('code'));
  const words = ['INTELLIGENT WORKFLOWS', 'AI AUTOMATIONS', 'SECURITY WORKFLOWS', 'AI-ASSISTED REPORTING'];
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ001010101010101';
  const body = document.createElement('div');
  body.className = 'code-body';
  root.replaceChildren(body);
  let paused = false, disposed = false, visible = !document.hidden, intersecting = true;
  let frame = 0, lastTime = 0, elapsed = 0, nextCharacter = 1400, nextScramble = 0;
  let lineIndex = 0, tokenIndex = 0, characterIndex = 0, typedCharacters = 0, holding = false;
  let spans = [], cursor, currentRow;

  function addRow(parts, complete = false) {
    const row = document.createElement('div');
    row.className = 'code-line';
    const tokens = parts.map(part => {
      const span = document.createElement('span');
      span.className = part.type;
      span.textContent = complete ? part.text : '';
      row.append(span);
      return span;
    });
    if (!parts.length) row.append('\u00a0');
    body.append(row);
    while (body.children.length > 14) body.firstElementChild.remove();
    return { row, tokens };
  }
  function beginRow() {
    cursor?.remove();
    const added = addRow(lines[lineIndex]);
    currentRow = added.row;
    spans = added.tokens;
    cursor = document.createElement('span');
    cursor.className = 'code-cursor';
    currentRow.append(cursor);
  }
  function resetStream() {
    body.replaceChildren();
    lineIndex = tokenIndex = characterIndex = typedCharacters = 0;
    holding = false;
    beginRow();
  }
  function staticText() {
    body.replaceChildren();
    for (const line of lines.slice(-14)) addRow(line, true);
    specialty.textContent = words[0];
  }
  function typeCharacter() {
    if (holding) {
      resetStream();
      nextCharacter += 650;
      return;
    }
    const parts = lines[lineIndex];
    if (tokenIndex >= parts.length) {
      tokenIndex = characterIndex = 0;
      lineIndex++;
      if (lineIndex === lines.length) {
        holding = true;
        nextCharacter += 6000;
      } else {
        beginRow();
        nextCharacter += 180 + Math.random() * 380;
      }
      return;
    }
    const text = parts[tokenIndex].text;
    characterIndex++;
    typedCharacters++;
    spans[tokenIndex].textContent = text.slice(0, characterIndex);
    const char = text[characterIndex - 1];
    nextCharacter += 22 + Math.random() * 42 + (char === ' ' ? 30 + Math.random() * 60 : 0) + (Math.random() < .04 ? 240 : 0);
    if (characterIndex === text.length) { tokenIndex++; characterIndex = 0; }
  }
  function rotateWord() {
    const cycle = Math.floor(elapsed / 7000);
    const target = words[cycle % words.length];
    const progress = Math.min(1, (elapsed % 7000) / 1800);
    specialty.textContent = cycle === 0 || progress === 1 ? target : [...target].map((char, index) => {
      if (char === ' ' || progress >= .5 + index / target.length * .5) return char;
      return alphabet[Math.floor(Math.random() * alphabet.length)];
    }).join('');
  }
  function running() { return !disposed && !paused && !reducedMotion && visible && intersecting; }
  function stop() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; }
  function request() { if (!frame && running()) frame = requestAnimationFrame(tick); }
  function tick(now) {
    frame = 0;
    if (!running()) return;
    elapsed += lastTime ? now - lastTime : 0;
    lastTime = now;
    if (innerWidth > 767) {
      let budget = 20;
      while (elapsed >= nextCharacter && budget-- > 0) typeCharacter();
    } else nextCharacter = elapsed + 1400;
    if (elapsed >= nextScramble) { rotateWord(); nextScramble = elapsed + 45; }
    request();
  }
  const observer = new IntersectionObserver(([entry]) => {
    intersecting = entry.isIntersecting;
    stop(); request();
  });
  observer.observe(root.closest('.hero'));
  const onVisibility = () => { visible = !document.hidden; stop(); request(); };
  document.addEventListener('visibilitychange', onVisibility);
  resetStream();
  if (reducedMotion) staticText();
  request();
  return {
    setPaused(value) { paused = Boolean(value); stop(); request(); },
    setReducedMotion(value) {
      if (reducedMotion === Boolean(value)) return;
      reducedMotion = Boolean(value);
      stop();
      if (reducedMotion) staticText();
      else { resetStream(); nextCharacter = elapsed + 1400; }
      request();
    },
    reset() {
      elapsed = nextScramble = 0; nextCharacter = 1400;
      resetStream(); specialty.textContent = words[0];
      if (reducedMotion) staticText();
      stop(); request();
    },
    getDiagnostics() { return { paused, reducedMotion, disposed, visible, intersecting, elapsed, typedCharacters, rows: body.children.length, text: body.textContent, specialty: specialty.textContent }; },
    dispose() { disposed = true; stop(); observer.disconnect(); document.removeEventListener('visibilitychange', onVisibility); },
  };
}
