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
    var headers = request.headers;

    // Credentials: dev / thirukkural
    // echo -n "dev:thirukkural" | base64 -> ZGV2OnRoaXJ1a2t1cmFs
    var authString = "Basic ZGV2OnRoaXJ1a2t1cmFs";

    if (
        typeof headers.authorization === "undefined" ||
        headers.authorization.value !== authString
    ) {
        return {
            statusCode: 401,
            statusDescription: "Unauthorized",
            headers: {
                "www-authenticate": { value: "Basic realm=\"Thirukkural Dev Access\"" },
            },
        };
    }

    request.uri = rewriteUri(request.uri);
    return request;
}
