"""Block external test connections while allowing Windows asyncio's local socketpair."""
import ipaddress
import socket
from unittest.mock import patch

_CONNECT = socket.socket.connect
_CONNECT_EX = socket.socket.connect_ex


def loopback_only(original):
    def guarded(sock, address):
        try:
            allowed = isinstance(address, tuple) and ipaddress.ip_address(address[0]).is_loopback
        except ValueError:
            allowed = False  # Hostnames are not an escape hatch through DNS.
        if not allowed:
            raise AssertionError('External network calls are blocked in tests')
        return original(sock, address)
    return guarded


def block_external_network():
    return patch.multiple(socket.socket, connect=loopback_only(_CONNECT), connect_ex=loopback_only(_CONNECT_EX))
