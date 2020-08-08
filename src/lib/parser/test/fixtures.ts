import { ContextProviderFactory } from "../complete";

export const NullCompletion: ContextProviderFactory = {
  get: async () => ({
    get: async (context: string) => {
      switch (context) {
        case "secrets": {
          return {
            AZURE_KEY: "",
          };
        }
      }

      return {};
    },
  }),
};
