class Snapshot {
    constructor(imageUrl, savedDom) {
        Object.defineProperty(this, "imageUrl", {value: imageUrl, enumerable: true});
        Object.defineProperty(this, "savedDom", {value: savedDom, enumerable: true});
    }
}
