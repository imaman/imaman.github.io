const drawTagger = (() => {
    class Higligther {
        constructor(ctx, matrix, statusBarElement, snapshot) {
            this.ctx = ctx;
            this.matrix = matrix;
            this.layoutTreeNode = null;
            this.statusBarElement = statusBarElement;
            this.snapshot = snapshot;
        }


        change(layoutTreeNode) {
            function findChain(nodes, index) {
                const ret = [];
                ret.push(nodes[index]);
                while (true) {
                    const parent = nodes.find(x => (x.childNodeIndexes || []).includes(index));
                    if (!parent) {
                        ret.reverse();
                        return ret;
                    }
                    const idx = nodes.indexOf(parent);
                    ret.push(parent);
                    index = idx;
                }
            }

            function show(layoutTreeNode) {
                return !layoutTreeNode ? 'NONE' : layoutTreeNode.domNodeIndex;
            }
            console.log(`Changing from ${show(this.layoutTreeNode)} -> ${show(layoutTreeNode)}`);
            
            let text = 'NONE';
            if (layoutTreeNode) {

                const chain = findChain(this.snapshot.domNodes, layoutTreeNode.domNodeIndex)
                    .filter(n => n.nodeName !== '#document' && n.nodeName !== 'HTML');

                text = chain.map(n => {
                    let attrs = '';
                    if (n.attributes) {
                        attrs = ' ' + n.attributes.map(a => `${a.name}="${a.value}"`).join(' ');
                    }

                    let val = '';
                    if (n.nodeValue) {
                        val = ` : ${n.nodeValue}`;
                    }
                    return `<${n.nodeName}${attrs}>${val}`;
                }).join('; ');
            }

            this.statusBarElement.text(text);
            this.layoutTreeNode = layoutTreeNode;
        }

        clear() {
            console.log('CLEARING');
            // this.ctx.save();

            // Use the identity matrix while clearing the canvas
            // this.matrix.transform(1, 0, 0, 1, 0, 0);

            if (this.layoutTreeNode) {
                const box = this.layoutTreeNode.boundingBox;
                this.ctx.strokeStyle = 'rgba(255, 0, 0, 0)';
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0)';
                this.ctx.fillRect(box.x, box.y, box.width, box.height);
                this.ctx.stroke();
            } else {
                console.log('this.layoutTreeNode is null');
            }
        }

        draw(layoutTreeNode) {
            if (layoutTreeNode === this.layoutTreeNode) {
                return;
            }

            this.clear();


            this.change(layoutTreeNode);
            if (!layoutTreeNode) {
                return;
            }

            const box = layoutTreeNode.boundingBox;
            this.ctx.strokeStyle = 'rgba(255, 0, 0, 1)';
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
            this.ctx.fillRect(box.x, box.y, box.width, box.height);
            this.ctx.stroke();

        }
    }

    function findLayoutTreeNode(snapshot, pos) {
        const nodes = snapshot.layoutTreeNodes.filter(layoutTreeNode => {
            const box = layoutTreeNode.boundingBox;
            return pos.x >= box.x && pos.x < box.x + box.width && pos.y >= box.y && pos.y <= box.y + box.height;
        });

        if (!nodes.length) {
            console.log(`No nodes matched the given position ${JSON.stringify(pos)}`);
            return;
        }

        const nodesWithArea = nodes.map(layoutTreeNode => {
            return { layoutTreeNode, area: layoutTreeNode.boundingBox.width * layoutTreeNode.boundingBox.height};
        });

        const reducer = (soFar, current) => {
            return current.area < soFar.area ? current : soFar;
        };

        const node = nodesWithArea.reduce(reducer, nodesWithArea[0]);
        return node.layoutTreeNode;
    }

    function drawTagger(parentId, statusBarId, savedSnapshot, imageUrl) {
        const parent = document.getElementById(parentId);
        if (!parent) {
            throw new Error(`No element with ID ${parnentId} was found`);
        }

        const img = new Image();
        img.addEventListener('load', () => {

            const factor = 1.0;
            const canvasElementString = `<canvas width="${img.width * factor}" height="${img.height * factor}"></canvas>`;
            console.log('Creating new canvas...');
            const canvas = $(canvasElementString).addClass('first').addClass('base-element');
            $(canvas).appendTo(parent);
            const ctx = canvas[0].getContext('2d');

            ctx.scale(factor, factor);
            ctx.drawImage(img, 0, 0);        
            ctx.stroke();


            const canvas2 = $(canvasElementString).addClass('second').addClass('fills-base-element');
            const ctx2 = canvas2[0].getContext('2d');
            ctx2.globalCompositeOperation = "copy"

            const matrix = new Matrix(ctx);
            // Create an instance of our position handler
            const cm = new CanvasMouse(ctx2, {
                handleScroll: true,
                handleResize: true,
                handleScale: true,
                handleTransforms: true,
                matrix
            });

            const higlighter = new Higligther(ctx2, matrix, $(`#${statusBarId}`), savedSnapshot);

            // cm.init();

            canvas2[0].onmousemove = e => {
                e.preventDefault();
                e.stopPropagation();
                const pos = { x: e.clientX - parent.offsetLeft, y: e.clientY - parent.OffsetTop + parent.scrollTop };
                console.log(`X,Y=${pos.x}, ${pos.y}`);
                // console.log(`Y=${e.clientY}, STOP=${parent.scrollTop}`);
                // const pos = cm.getPos(e);
                const layoutTreeNode = findLayoutTreeNode(savedSnapshot, pos);
                higlighter.draw(layoutTreeNode);
            };


            canvas2.mouseleave(() => {
                higlighter.draw(null);
            });

            $(canvas2).appendTo(parent);
        });
        img.src = imageUrl;
    }

    return drawTagger;
})();
