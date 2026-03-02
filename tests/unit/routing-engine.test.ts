describe.skip('routing-engine', () => {
  it('scores PSPs using weighted cost/latency/reliability factors', () => {
    // TODO: add deterministic mocks for health tracker, rules, and redis circuit state.
  });

  it('applies FORCE/PREFER/EXCLUDE rules before final selection', () => {
    // FIXME: validate overlapping rules with priority handling.
  });
});
