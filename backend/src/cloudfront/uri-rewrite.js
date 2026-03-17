function rewriteUri(uri) {
    if (!uri || uri === "/") {
        return uri;
    }

    if (uri.endsWith("/")) {
        return uri + "index.html";
    }

    var lastSegment = uri.substring(uri.lastIndexOf("/") + 1);
    if (lastSegment.indexOf(".") !== -1) {
        return uri;
    }

    return uri + "/index.html";
}

function handler(event) {
    var request = event.request;
    request.uri = rewriteUri(request.uri);
    return request;
}
