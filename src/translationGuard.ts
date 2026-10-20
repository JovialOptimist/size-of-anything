/**
 * Keeps React working on a page the browser has translated (Chrome, Edge, the Google Translate
 * extension). Translators swap the text nodes React owns for their own <font> elements, so when
 * React later removes or inserts next to one of those nodes, the browser throws NotFoundError and
 * the whole app unmounts. See facebook/react#11538.
 *
 * Where a translator wrapped the node (Edge and the extension do), this acts on the wrapper, so the
 * text really goes away and new nodes land in the right place. Where it replaced the node (Chrome),
 * there's no way to find the replacement, so the old translated text stays until its parent goes.
 * That's only a safety net: text that changes should be keyed or kept out of translation (see Literal).
 */

/** The direct child of `parent` that contains `node`, or null if `node` isn't inside `parent`. */
function childContaining(parent: Node, node: Node): Node | null {
  let n: Node | null = node;
  while (n && n.parentNode !== parent) n = n.parentNode;
  return n;
}

let warned = false;
function note(method: string) {
  if (warned) return;
  warned = true;
  console.warn(`translationGuard: repaired a ${method} the page's translator broke.`);
}

export function installTranslationGuard() {
  if (typeof Node !== "function") return;
  const { removeChild, insertBefore } = Node.prototype;

  Node.prototype.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode === this) return removeChild.call(this, child) as T;
    note("removeChild");
    // The translator wrapped it: remove the wrapper, which holds the translated text.
    const wrapper = childContaining(this, child);
    if (wrapper) removeChild.call(this, wrapper);
    // The translator moved it elsewhere: it should still go.
    else if (child.parentNode) removeChild.call(child.parentNode, child);
    return child;
  };

  Node.prototype.insertBefore = function <T extends Node>(this: Node, node: T, ref: Node | null): T {
    if (!ref || ref.parentNode === this) return insertBefore.call(this, node, ref) as T;
    note("insertBefore");
    // Insert before the translator's wrapper of `ref`, or at the end if `ref` is gone.
    return insertBefore.call(this, node, childContaining(this, ref)) as T;
  };
}
