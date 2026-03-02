describe.skip('orchestrator', () => {
  it('handles payment state transitions and failover flow', () => {
    // TODO: add orchestrator integration fixture with mocked routing/fx/psp adapters.
  });

  it('runs saga compensation when all adapters fail', () => {
    // TODO: assert compensation side effects and emitted events.
  });
});
