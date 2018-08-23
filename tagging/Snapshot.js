class Snapshot {
    constructor(savedDom, imageUrl) {
        Object.defineProperty(this, "savedDom", {value: savedDom, enumerable: true});
        Object.defineProperty(this, "imageUrl", {value: imageUrl, enumerable: true});
    }
}
