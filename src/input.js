/**
 * 鼠标 + 触屏统一走 Pointer Events。只在这一文件使用浏览器事件 API。
 */

function eventToPoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export function attachInput(canvas, handlers) {
  let activePointerId = null;

  function onPointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    if (activePointerId !== null) return;

    activePointerId = event.pointerId;
    try {
      if (!document.body.classList.contains("overlay-open")) {
        canvas.setPointerCapture(event.pointerId);
      }
    } catch {
      // 部分环境没有 capture，松开时仍会收到 pointerup
    }
    event.preventDefault();
    handlers.onDown(eventToPoint(canvas, event));
  }

  function onPointerMove(event) {
    const point = eventToPoint(canvas, event);
    if (activePointerId === null || event.pointerId !== activePointerId) {
      handlers.onHover?.(point);
      return;
    }
    event.preventDefault();
    handlers.onMove(point);
  }

  function endPointer(event) {
    if (activePointerId === null || event.pointerId !== activePointerId) return;
    activePointerId = null;
    event.preventDefault();
    handlers.onUp(eventToPoint(canvas, event));
  }

  function onContextMenu(event) {
    event.preventDefault();
  }

  function onWheel(event) {
    if (!document.body.classList.contains("playing")) return;
    event.preventDefault();
    handlers.onWheel?.(event.deltaY);
  }

  const options = { passive: false };
  canvas.addEventListener("pointerdown", onPointerDown, options);
  canvas.addEventListener("pointermove", onPointerMove, options);
  canvas.addEventListener("pointerup", endPointer, options);
  canvas.addEventListener("pointercancel", endPointer, options);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, options);

  canvas._inputCleanup = () => {
    canvas.removeEventListener("pointerdown", onPointerDown, options);
    canvas.removeEventListener("pointermove", onPointerMove, options);
    canvas.removeEventListener("pointerup", endPointer, options);
    canvas.removeEventListener("pointercancel", endPointer, options);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("wheel", onWheel, options);
  };
}

export function detachInput(canvas) {
  canvas._inputCleanup?.();
  canvas._inputCleanup = undefined;
}
