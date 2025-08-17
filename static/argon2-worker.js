self.onmessage = async function (e) {
  const { password, salt, time, mem, parallelism, hashLen } = e.data;

  try {
    importScripts("/lib/argon2-wasm/emscripten-runner.js");
    const wasmBinary = new Uint8Array(await (await fetch("/lib/argon2-wasm/argon2.wasm")).arrayBuffer());
    const ArgonModule = Module({ wasmBinary });

    await new Promise((resolve) => {
      ArgonModule.onRuntimeInitialized = resolve;
    });

    const alloc = (str) => ArgonModule.allocate(ArgonModule.intArrayFromString(str), "i8", ArgonModule.ALLOC_NORMAL);
    const pwd = alloc(password),
      saltPtr = alloc(salt);
    const hash = ArgonModule.allocate(new Array(hashLen), "i8", ArgonModule.ALLOC_NORMAL);
    const encoded = ArgonModule.allocate(new Array(512), "i8", ArgonModule.ALLOC_NORMAL);

    const result = ArgonModule._argon2_hash(
      time,
      mem,
      parallelism,
      pwd,
      password.length,
      saltPtr,
      salt.length,
      hash,
      hashLen,
      encoded,
      512,
      0,
      0x13,
    );

    const cleanup = () => [pwd, saltPtr, hash, encoded].forEach((ptr) => ArgonModule._free(ptr));

    if (result === 0) {
      const hashHex = Array.from(new Uint8Array(hashLen), (_, i) =>
        (ArgonModule.HEAP8[hash + i] & 0xff).toString(16).padStart(2, "0"),
      ).join("");
      cleanup();
      self.postMessage({ hash: hashHex });
    } else {
      cleanup();
      throw new Error(`Argon2 error: ${result}`);
    }
  } catch (error) {
    self.postMessage({ error: `Argon2 computation failed: ${error.message}` });
  }
};
