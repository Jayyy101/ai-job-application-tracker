import socket
import unittest
from unittest.mock import Mock
from network_guard import block_external_network, loopback_only


class NetworkGuardTests(unittest.TestCase):
    def test_external_hosts_and_addresses_never_reach_socket(self):
        original = Mock()
        for address in [('api.openai.com', 443), ('1.1.1.1', 443), ('169.254.169.254', 80), ('localhost', 80)]:
            with self.assertRaises(AssertionError): loopback_only(original)(object(), address)
        original.assert_not_called()

    def test_literal_loopback_allows_internal_socketpair(self):
        original = Mock(return_value=0)
        for address in [('127.0.0.1', 12345), ('::1', 12345, 0, 0)]:
            self.assertEqual(loopback_only(original)(object(), address), 0)
        self.assertEqual(original.call_count, 2)

    def test_connect_and_connect_ex_are_both_guarded(self):
        with block_external_network(), socket.socket() as sock:
            for operation in [sock.connect, sock.connect_ex]:
                with self.assertRaises(AssertionError): operation(('1.1.1.1', 443))
