# EXPECT: BLOCKED
import socket
socket.create_connection(("example.com", 80))
