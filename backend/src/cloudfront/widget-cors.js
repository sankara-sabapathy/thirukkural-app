function handler(event) {
    var response = event.response;
    var headers = response.headers;

    headers["access-control-allow-origin"] = { value: "*" };

    return response;
}
