export async function precompileJavascriptCode(content) {
    const prc = import(/* webpackChunkName: "babel-precompile", webpackPrefetch: true */ "./preCompileModule");
  
    return (await prc).precompileJavascriptCode(content);
  }
