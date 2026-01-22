// Address encoding helpers from official Stacks USDCx documentation
import * as P from 'micro-packed';
import { createAddress, addressToString, AddressVersion, StacksWireType } from '@stacks/transactions';
import { hex } from '@scure/base';
import { type Hex, pad, toHex } from "viem";

/**
 * Encode Stacks address to bytes32 format for xReserve
 * This is the EXACT implementation from official Stacks docs
 */
export const remoteRecipientCoder = P.wrap<string>({
  encodeStream(w, value: string) {
    const address = createAddress(value);
    P.bytes(11).encodeStream(w, new Uint8Array(11).fill(0));
    P.U8.encodeStream(w, address.version);
    P.bytes(20).encodeStream(w, hex.decode(address.hash160));
  },
  decodeStream(r) {
    P.bytes(11).decodeStream(r);
    const version = P.U8.decodeStream(r);
    const hash = P.bytes(20).decodeStream(r);
    return addressToString({
      hash160: hex.encode(hash),
      version: version as AddressVersion,
      type: StacksWireType.Address,
    });
  },
});

/**
 * Convert bytes to bytes32 hex format
 */
export function bytes32FromBytes(bytes: Uint8Array): Hex {
  return toHex(pad(bytes, { size: 32 }));
}

/**
 * Encode Stacks address for xReserve deposit
 */
export function encodeStacksAddress(stacksAddress: string): Hex {
  return bytes32FromBytes(remoteRecipientCoder.encode(stacksAddress));
}

/**
 * Pad Ethereum address to 32 bytes for Stacks withdrawal
 */
export function padEthereumAddress(ethereumAddress: string): Hex {
  return pad(`0x${ethereumAddress.replace('0x', '')}` as Hex, { size: 32 });
}

/**
 * Validate Stacks address format
 */
export function isValidStacksAddress(address: string): boolean {
  try {
    createAddress(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Convert USDC amount to micro-USDC (6 decimals)
 */
export function toMicroUSDC(amount: string): bigint {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error('Invalid amount');
  }
  return BigInt(Math.floor(parsed * 1_000_000));
}

/**
 * Convert micro-USDC to readable amount
 */
export function fromMicroUSDC(microAmount: bigint): string {
  return (Number(microAmount) / 1_000_000).toFixed(6);
}