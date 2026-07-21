export const workerLog = (workerName: string, jobId: string | undefined, msg: string, extra?: unknown) => {
  const prefix = `[${workerName}]${jobId ? ` [job:${jobId}]` : ""}`;
  if (extra !== undefined) {
    console.log(`${prefix} ${msg}`, extra);
  } else {
    console.log(`${prefix} ${msg}`);
  }
};
