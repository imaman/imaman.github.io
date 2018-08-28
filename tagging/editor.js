const drawTagger = (() => {
    class Higligther {
        constructor(ctx, statusBarElement, snapshot) {
            this.ctx = ctx;
            this.layoutTreeNode = null;
            this.statusBarElement = statusBarElement;
            this.snapshot = snapshot;
            this.isSelected = false;
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

            const computeChainData = domNodeIndex => {
                return findChain(this.snapshot.domNodes, domNodeIndex)
                    .filter(n => n.nodeName !== '#document' && n.nodeName !== 'HTML')
                    .map(n => {
                        let attrs = '';
                        if (n.attributes) {
                            attrs = n.attributes.map(a => `${a.name}="${a.value}"`).join(' ');
                        }

                        let val = '';
                        if (n.nodeValue) {
                            val = ` : ${n.nodeValue}`;
                        }
                        return {
                            tag: n.nodeName,
                            attributes: attrs,
                            value: val
                        };
                    })
                    .map(c => `<div class="parenthood-chain-entry"><span class="vertical-center">&lt;${c.tag}&gt;</span></div>`);
            };
            
            let chain = null;
            if (!layoutTreeNode) {
                chain = [];
            } else {
                chain = computeChainData(layoutTreeNode.domNodeIndex);
            }

            while(chain.length < 48) {
                chain.push('<div class="parenthood-chain-entry empty">NONE</div>');
            }
            this.statusBarElement.html(chain.join('\n'));
            this.layoutTreeNode = layoutTreeNode;
        }

        clear() {
            if (this.isSelected) {
                return;
            }

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
            if (this.isSelected) {
                return;            
            }

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
        
        select(layoutTreeNode) {
            if (this.isSelected) {
                this.isSelected = false;
                this.clear();
                this.change(null);
                return;
            }
            this.isSelected = false;
            this.clear();
            this.change(null);
            this.draw(layoutTreeNode);
            this.isSelected = true;
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

    function drawTagger(container, snapshot, services) {
        const { savedDom,  imageUrl } = snapshot;

        const parent = container.find('.snapshot-view');
        if (!parent.length) {
            throw new Error(`No .snpshot-view element was found`);
        }

        const statusBarElement = container.find('.parenthood-chain-indicator');
        if (!statusBarElement.length) {
            throw new Error('No .parenthood-chain-indicator element was found');
        }

        const snapshotHeader = container.find('.snapshot-header');
        snapshotHeader.find('.snapshot-metadata').html(
            `<a href="${snapshot.metadata.snapshotUrl}">${snapshot.metadata.snapshotTimestamp}</a>`);
        snapshotHeader.find('.reject').click(async function() {
            const confirmed = confirm("Are you sure you want to reject the snapshot?");
            if (confirmed) {
                services.reportMessage('Rejecting...');
                try {
                    const resp = await services.lambdaClient.reject(snapshot);
                    console.log('reject response=\n' + JSON.stringify(resp));
                    if (!resp.numRejectedArenas) {
                        console.log('rejection response=', resp);
                        throw new Error('Did not succeed to reject the snapshot');
                    }
                    location.href = '?';
                } catch (e) {
                    services.reportError(e);
                }
            }
        });
        snapshotHeader.find('.recapture').click(async function() {
            services.reportMessage('Rejecting...');
            await new Promise(resolve => setTimeout(resolve, 2000))
            try {
                const resp = await services.lambdaClient.recapture(snapshot);
                console.log('recapture response=\n' + JSON.stringify(resp));
                location.reload();
            } catch (e) {
                services.reportError(e);
            }
        });
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

            // const matrix = new Matrix(ctx);
            // // Create an instance of our position handler
            // const cm = new CanvasMouse(ctx2, {
            //     handleScroll: true,
            //     handleResize: true,
            //     handleScale: true,
            //     handleTransforms: true,
            //     matrix
            // });

            const higlighter = new Higligther(ctx2, statusBarElement, savedDom);
            higlighter.change(null);

            // cm.init();

            function posFromEvent(e) {
                const parentOffset = parent.offset();
                return { 
                    x: e.clientX - parentOffset.left + parent.scrollLeft() + document.documentElement.scrollLeft, 
                    y: e.clientY - parentOffset.top + parent.scrollTop() + document.documentElement.scrollTop 
                };
            }

            canvas2.mousemove(e => {
                e.preventDefault();
                e.stopPropagation();
                const pos = posFromEvent(e);
                const layoutTreeNode = findLayoutTreeNode(savedDom, pos);
                higlighter.draw(layoutTreeNode);
            });

            canvas2.click(e => {
                e.preventDefault();
                e.stopPropagation();
                const pos = posFromEvent(e);
                const layoutTreeNode = findLayoutTreeNode(savedDom, pos);
                higlighter.select(layoutTreeNode);
            });

            canvas2.mouseleave(() => {
                higlighter.draw(null);
            });

            $(canvas2).appendTo(parent);
        });
        img.src = imageUrl;
    }

    return drawTagger;
})();
