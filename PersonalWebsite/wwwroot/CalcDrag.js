function bringToFront(target) {
    // Increment a global z-index counter
    if (!window.maxZIndex) {
        window.maxZIndex = 1000;
    }
    window.maxZIndex++;
    target.style.zIndex = window.maxZIndex;
}

// Call bringToFront in event handlers
function dragMoveListener(event) {
    let target = event.target;
    bringToFront(target);
    // Existing code...
}

window.interop = {
    makeDraggableResizable: function (elementId) {
        interact('#' + elementId)
            .draggable({
                inertia: true,
                modifiers: [
                    interact.modifiers.restrictRect({
                        restriction: 'parent',
                        endOnly: true
                    })
                ],
                autoScroll: true,
                onmove: dragMoveListener
            })
            .resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                modifiers: [
                    interact.modifiers.restrictEdges({
                        outer: 'parent',
                        endOnly: true
                    }),
                    interact.modifiers.restrictSize({
                        min: { width: 200, height: 100 },
                        max: { width: 800, height: 600 }
                    })
                ],
                inertia: true
            })
            .on('resizemove', function (event) {
                let target = event.target;
                let x = (parseFloat(target.getAttribute('data-x')) || 0);
                let y = (parseFloat(target.getAttribute('data-y')) || 0);

                // Update the element's style
                target.style.width = event.rect.width + 'px';
                target.style.height = event.rect.height + 'px';

                // Translate when resizing from top or left edges
                x += event.deltaRect.left;
                y += event.deltaRect.top;

                target.style.transform = 'translate(' + x + 'px,' + y + 'px)';

                target.setAttribute('data-x', x);
                target.setAttribute('data-y', y);
            });

        function dragMoveListener(event) {
            let target = event.target;
            // Keep the dragged position in the data-x/data-y attributes
            let x = (parseFloat(target.getAttribute('data-x')) || 0) + event.dx;
            let y = (parseFloat(target.getAttribute('data-y')) || 0) + event.dy;

            // Translate the element
            target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

            // Update the position attributes
            target.setAttribute('data-x', x);
            target.setAttribute('data-y', y);
        }
    }
};
