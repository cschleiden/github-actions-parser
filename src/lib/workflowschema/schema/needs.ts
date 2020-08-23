import { CustomValueProvider } from "../../parser/schema";

export const NeedsCustomValueProvider: CustomValueProvider = async (
  _,
  workflow,
  path
) => {
  const jobId = path[path.length - 2];
  return (
    (jobId &&
      workflow.jobs &&
      Object.keys(workflow.jobs)
        .filter((x) => x !== jobId)
        .map((x) => ({
          value: x,
        }))) ||
    []
  );
};
