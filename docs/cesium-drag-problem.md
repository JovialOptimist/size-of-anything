# Why Cesium Polygon Drag Doesn’t Work (And What To Do Instead)

## What we’re doing today

- We draw area polygons as **Cesium Entities** with `polygon: { hierarchy, ... }`.
- On **drag**: we do **not** update the store during the drag. We call `updateAreaEntitiesInPlace()` so that the **same** entities get a new `entity.polygon.hierarchy` (we set it to `new ConstantProperty(hierarchy)` with the translated coordinates). On **mouse up** we call `updateCurrentCoordinates()` once to commit to the store; the sync effect then runs and does `removeAll()` + re-add from `geojsonAreas`.

**Observed behavior:** The shape does **not** follow the mouse during drag; it only jumps when you release the button. The background (globe/imagery) can flash. So the “in-place” Entity update is not giving a smooth, visible drag.

---

## Root cause: Entity geometry is asynchronous and recreated

This comes from how Cesium’s **Entity API** is designed and from known issues in the codebase and issues (e.g. CesiumGS/cesium#7934, community threads).

### 1. Entity polygon geometry is updated **asynchronously**

- When you set `entity.polygon.hierarchy = ...` (whether a raw `PolygonHierarchy` or `new ConstantProperty(hierarchy)`), Cesium does **not** redraw the polygon in the same frame.
- The Entity layer builds/updates the **underlying primitive** (the actual drawable geometry) asynchronously. So:
  - Our MOUSE_MOVE → `updateAreaEntitiesInPlace()` → assign new hierarchy might not show up until later, or might be batched in a way that doesn’t match the cursor.
  - The only time we see a clear update is on **mouse up**, when we update the **store** and the **effect** runs: `ds.entities.removeAll()` and re-add from `geojsonAreas`. That’s a full replace of the data source, so Cesium redraws from the new data. So the shape “jumps” at release, not during drag.

So: **relying on “change entity.polygon.hierarchy during drag” does not give real-time visual updates** because Entity geometry updates are async.

### 2. Replacing the hierarchy causes **recreate → blink**

- Even when an update is applied, changing the hierarchy (or replacing the Property that holds it) causes Cesium to **tear down the old geometry and create new geometry**.
- That recreate is done asynchronously. So you get:
  - One frame (or more) with old geometry,
  - Then it’s removed,
  - Then new geometry is built.
- Result: **blinking / flashing**. The “background flashing” you see is consistent with the polygon (or its slot) being removed and re-added or the scene being invalidated during that process.

So: **updating hierarchy in place on the Entity is the wrong lever** for smooth, non-flashing drag.

### 3. Why “ConstantProperty” didn’t fix it

- We switched to `entity.polygon.hierarchy = new ConstantProperty(hierarchy)` so that we assign a proper **Property** instead of a raw value.
- But we still **replace** that Property on every (batched) drag update. So from Cesium’s point of view we’re still “changing the entity’s polygon” every time → async update + geometry recreate → same “no follow during drag” and same flashing.

So the fix isn’t “use ConstantProperty” — it’s to **avoid replacing the property every frame** and/or **avoid relying on Entity’s async geometry update** for drag.

---

## What Cesium expects for “dynamic” polygons

From the Cesium team and community (e.g. issue #7934, Stack Overflow, “Entity vs Primitive” threads):

- **Static entities (our current case):** You set a hierarchy once (or change it occasionally). Geometry is created/updated **asynchronously**. Changing it causes recreate → **blink** and often **delayed** visibility.
- **Dynamic entities:** You use a **CallbackProperty** for `hierarchy`, with `isConstant: false`. The **same** Property object stays on the entity; each frame Cesium **calls the callback** and uses the returned `PolygonHierarchy`. So the geometry is considered “dynamic” and is drawn **synchronously** from the callback. No “replace property” → no tear-down/recreate every frame → **smooth, no blink** (in principle).

So for smooth drag you either:

- Use **CallbackProperty** so the hierarchy is read from a callback every frame (one Property, no replace), or  
- Leave the Entity API for this and use the **Primitive API** (see below).

---

## Fundamentally different approaches

### A. CallbackProperty (stay on Entity API)

- **Idea:** When we **create** the entity, we set  
  `polygon: { hierarchy: new CallbackProperty(() => buildHierarchyFrom(currentCoordsRef), false) }`  
  and never replace that Property. During drag we only update a **ref** (e.g. `currentCoordsRef` per featureId); the callback returns the current hierarchy each frame.
- **Pros:** Smooth drag, no replacing hierarchy on the entity, no async geometry delay. Stays in the Entity world (picking, labels, etc. can stay as they are).
- **Cons:**
  - We currently create entities from `geojsonAreas` in one place; we’d need a single “live” source of coordinates (e.g. ref or store) that the callback reads from for **all** area entities (or at least the one being dragged).
  - CallbackProperty is evaluated **every frame** for dynamic geometry → more CPU/GPU.
  - There are known Cesium bugs (e.g. CallbackProperty for polygon hierarchy, double-render) in some versions; we’d need to verify on our Cesium version.

### B. Primitive API for (at least) the dragged shape

- **Idea:** Don’t drive the **dragged** polygon from the Entity data source. Use a **Primitive** or **GroundPrimitive** with `PolygonGeometry` instead. On each drag update (or once per frame):
  - Remove the old primitive for that shape.
  - Add a new primitive with `PolygonGeometry` built from the current translated coordinates.
  - Use `asynchronous: false` so geometry is created synchronously and avoid the “undefined geometry” / blink issues reported in the community.
- **Pros:** No Entity async/Property semantics for the moving polygon; we control exactly when geometry is created and when the scene is rendered. Matches the “remove old, add new, requestRender” pattern the Cesium team suggests for intermittent updates.
- **Cons:** More code (managing primitives, optional custom picking), and we must keep “which shape is being dragged” and its current coordinates outside the Entity list.

### C. No in-place update during drag

- **Idea:** Don’t touch Cesium during drag. Only on **mouse up** call `updateCurrentCoordinates()`. The shape will “jump” to the new position when you release.
- **Pros:** Simple, no flashing from in-place Entity updates, no CallbackProperty or Primitive work.
- **Cons:** Poor UX: shape doesn’t follow the cursor during drag.

---

## Summary

| What we did | Why it fails |
|------------|----------------|
| Update `entity.polygon.hierarchy` (or ConstantProperty) during drag | Entity geometry is updated **asynchronously**; the polygon doesn’t redraw in sync with the mouse, so the shape doesn’t follow. |
| Same update | Replacing the hierarchy (or its Property) **recreates** geometry → **blinking/flashing**. |
| Rely on store + effect only at mouse up | That’s why the shape **does** move when you release: the effect does removeAll + re-add from store, which is a full refresh. |

So the problem is **architectural**: the Entity API is a bad fit for “update this polygon’s shape every frame during drag” when we do it by **replacing** the hierarchy. The robust fixes are either **CallbackProperty** (one hierarchy Property, callback returns current coords each frame) or **Primitive API** for the dragged polygon (no Entity for that geometry during drag). Choosing between A and B is the “fundamentally different approach” we need.
