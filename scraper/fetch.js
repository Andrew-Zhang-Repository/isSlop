function img_find() {
    var imgs = Array.from(document.getElementsByTagName('img'));
    var filtered = imgs.filter(img => {
        const rect = img.getBoundingClientRect();

        const largeEnough =
            rect.width >= 300 &&
            rect.height >= 200;

        const bounds = rect.top < window.innerHeight &&
            rect.bottom > 0 &&
            rect.left < window.innerWidth &&
            rect.right > 0


        return (
            bounds && largeEnough
        );
    });

    var imgSrcs = [];
    
    for (var i = 0; i < filtered.length; i++) {
        imgSrcs.push(filtered[i].src);
    }

    return imgSrcs;
}

img_find()