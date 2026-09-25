/**
 * Type shims for the x402 packages.
 *
 * They expose their entry points through a package "exports" map, which this
 * project's `moduleResolution: node` cannot read. Node itself resolves the
 * clean specifiers fine at runtime, so only the compiler needs help — doing it
 * here rather than via tsconfig `paths`, because a paths mapping also rewrites
 * tsx's *runtime* resolution and makes it try to require a .d.ts file.
 *
 * Switching the server to node16 resolution would be the tidier fix, but it
 * breaks the ESM-only Solana packages that the rest of the server imports.
 */

declare module '@x402/core/facilitator' {
  export * from '@x402/core/dist/cjs/facilitator/index';
}

declare module '@x402/core/types' {
  export * from '@x402/core/dist/cjs/types/index';
}

declare module '@x402/evm/exact/facilitator' {
  export * from '@x402/evm/dist/cjs/exact/facilitator/index';
}
