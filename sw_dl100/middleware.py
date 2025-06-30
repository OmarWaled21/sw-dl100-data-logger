from django.http import HttpResponseForbidden

class OnlyAllowFromCaddyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        allowed = request.META.get("HTTP_X_CADDY", "") == "1"
        if not allowed:
            return HttpResponseForbidden("Access Denied: Only via Caddy")
        return self.get_response(request)
