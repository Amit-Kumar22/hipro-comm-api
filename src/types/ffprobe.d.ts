declare module 'ffprobe' {
  function ffprobe(filePath: string, options: { path: string }): Promise<any>;
  export = ffprobe;
}

declare module 'ffprobe-static' {
  const ffprobeStatic: string;
  export = ffprobeStatic;
}