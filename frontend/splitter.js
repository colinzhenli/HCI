document.addEventListener('DOMContentLoaded', function() {
    // ========== Horizontal Splitter (between Reference Video and 3D Scene) ==========
    const trackingSection = document.getElementById('tracking-section');
    const diagramSection = document.getElementById('diagram-section');
    const splitterRow = document.getElementById('splitter-row');
    const rightColumn = document.getElementById('right-column');
    
    let isResizingRow = false;

    if (trackingSection && diagramSection && splitterRow && rightColumn) {
        splitterRow.addEventListener('mousedown', function(e) {
            isResizingRow = true;
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    }

    // ========== Vertical Splitter (between Main Video and Right Column) ==========
    const videoSection = document.getElementById('video-section');
    const splitterCol = document.getElementById('splitter-col');
    const mainLayout = document.querySelector('.main-layout');
    
    let isResizingCol = false;

    if (videoSection && rightColumn && splitterCol && mainLayout) {
        splitterCol.addEventListener('mousedown', function(e) {
            isResizingCol = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
    }

    // ========== Mouse Move Handler ==========
    document.addEventListener('mousemove', function(e) {
        // Handle horizontal splitter (row)
        if (isResizingRow && rightColumn) {
            const containerRect = rightColumn.getBoundingClientRect();
            const splitterHeight = 8;
            
            let topHeight = e.clientY - containerRect.top;
            let bottomHeight = containerRect.height - topHeight - splitterHeight;
            
            const minHeight = 100;
            
            if (topHeight < minHeight) {
                topHeight = minHeight;
                bottomHeight = containerRect.height - topHeight - splitterHeight;
            }
            if (bottomHeight < minHeight) {
                bottomHeight = minHeight;
                topHeight = containerRect.height - bottomHeight - splitterHeight;
            }
            
            trackingSection.style.flex = '0 0 ' + topHeight + 'px';
            diagramSection.style.flex = '0 0 ' + bottomHeight + 'px';
            
            window.dispatchEvent(new Event('resize'));
        }
        
        // Handle vertical splitter (column)
        if (isResizingCol && mainLayout) {
            const containerRect = mainLayout.getBoundingClientRect();
            const splitterWidth = 8;
            
            let leftWidth = e.clientX - containerRect.left;
            let rightWidth = containerRect.width - leftWidth - splitterWidth;
            
            const minWidth = 200;
            
            if (leftWidth < minWidth) {
                leftWidth = minWidth;
                rightWidth = containerRect.width - leftWidth - splitterWidth;
            }
            if (rightWidth < minWidth) {
                rightWidth = minWidth;
                leftWidth = containerRect.width - rightWidth - splitterWidth;
            }
            
            videoSection.style.flex = '0 0 ' + leftWidth + 'px';
            rightColumn.style.flex = '0 0 ' + rightWidth + 'px';
            
            window.dispatchEvent(new Event('resize'));
        }
    });

    // ========== Mouse Up Handler ==========
    document.addEventListener('mouseup', function() {
        if (isResizingRow) {
            isResizingRow = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.dispatchEvent(new Event('resize'));
        }
        if (isResizingCol) {
            isResizingCol = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.dispatchEvent(new Event('resize'));
        }
    });
});
