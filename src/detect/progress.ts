export type TestItem = { given: string; when: string; then: string };

export type TestProgress = {
  status: "unknown" | "likely_done";
  test: TestItem;
  reason?: string;
};

export function mapProgress(tests: TestItem[]): TestProgress[] {
  // v0: conservative. Default to unknown.
  return tests.map((test) => ({ status: "unknown", test }));
}

