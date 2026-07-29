import { useMutation } from "@tanstack/react-query";
import { generateMeetLinkRequest } from "./requests";
import type { GenerateMeetLinkRequest, GenerateMeetLinkResponse } from "@examify-tms/interfaces";

export function useGenerateMeetLink() {
  return useMutation<GenerateMeetLinkResponse, Error, GenerateMeetLinkRequest | undefined>({
    mutationFn: (data) => generateMeetLinkRequest(data),
  });
}
