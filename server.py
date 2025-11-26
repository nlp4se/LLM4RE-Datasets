#!/usr/bin/env python3
"""
Simple HTTP server with SPA (Single Page Application) support.
Serves index.html for all routes that don't match actual files.
"""
import http.server
import socketserver
import os
import urllib.parse

class SPAHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers if needed
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()
    
    def do_GET(self):
        # Parse the URL
        parsed_path = urllib.parse.urlparse(self.path)
        path = parsed_path.path
        
        # Remove leading slash
        if path.startswith('/'):
            path = path[1:]
        
        # If path is empty, serve index.html
        if path == '' or path == '/':
            path = 'index.html'
        
        # Check if the requested path is an actual file
        if os.path.isfile(path):
            # Serve the file
            super().do_GET()
        else:
            # Check if it's a directory (serve index.html from that directory)
            if os.path.isdir(path):
                self.path = path + '/index.html'
                super().do_GET()
            else:
                # For any other path (like /D003), serve index.html
                # This allows client-side routing to work
                self.path = '/index.html'
                super().do_GET()

def run(port=8000):
    handler = SPAHTTPRequestHandler
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Server running at http://localhost:{port}/")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    run(port)

