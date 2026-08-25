import { describe, expect, it } from 'vitest';

import { applyAgeProgression, clubSeasonReset, playerSeasonReset } from './season';
import { deriveAttributes } from './ratings';

describe('applyAgeProgression', () => {
  it('grows a young player toward potential, never past it', () => {
    const result = applyAgeProgression({ id: 'p1', overall: 65, potential: 80, age: 20, position: 'MF' });
    expect(result.age).toBe(21);
    expect(result.overall).toBeGreaterThan(65);
    expect(result.overall).toBeLessThanOrEqual(80);
  });

  it('caps growth exactly at potential when headroom is small', () => {
    // Headroom of 1 -- growth (1..4) must still clamp to exactly potential, not overshoot.
    const result = applyAgeProgression({ id: 'p2', overall: 79, potential: 80, age: 19, position: 'FW' });
    expect(result.overall).toBe(80);
  });

  it('leaves a peak-age player (24-29) unchanged', () => {
    // Input age is pre-rollover -- the function increments it, so these
    // land on newAge 24/26/29, the peak band's boundaries and midpoint.
    for (const age of [23, 25, 28]) {
      const result = applyAgeProgression({ id: 'p3', overall: 74, potential: 80, age, position: 'DF' });
      expect(result.overall).toBe(74);
    }
  });

  it('declines a player over 30, and the decline accelerates with age', () => {
    const at30 = applyAgeProgression({ id: 'p4', overall: 78, potential: 78, age: 30, position: 'FW' });
    const at34 = applyAgeProgression({ id: 'p4', overall: 78, potential: 78, age: 34, position: 'FW' });
    const at37 = applyAgeProgression({ id: 'p4', overall: 78, potential: 78, age: 37, position: 'FW' });
    expect(at30.overall).toBeLessThan(78);
    expect(at34.overall).toBeLessThanOrEqual(at30.overall);
    expect(at37.overall).toBeLessThanOrEqual(at34.overall);
  });

  it('never declines below the rating floor of 45', () => {
    const result = applyAgeProgression({ id: 'p5', overall: 46, potential: 46, age: 38, position: 'DF' });
    expect(result.overall).toBeGreaterThanOrEqual(45);
  });

  it('is deterministic -- same inputs, same outputs', () => {
    const a = applyAgeProgression({ id: 'p6', overall: 70, potential: 75, age: 22, position: 'MF' });
    const b = applyAgeProgression({ id: 'p6', overall: 70, potential: 75, age: 22, position: 'MF' });
    expect(a).toEqual(b);
  });

  it('re-derives attributes consistently with the new overall', () => {
    const result = applyAgeProgression({ id: 'p7', overall: 70, potential: 85, age: 20, position: 'FW' });
    const expectedAttributes = deriveAttributes(result.overall, 'FW', 'p7');
    expect(result.shooting).toBe(expectedAttributes.shooting);
    expect(result.pace).toBe(expectedAttributes.pace);
  });

  it('defaults missing age/potential sensibly rather than throwing', () => {
    expect(() => applyAgeProgression({ id: 'p8', overall: null, potential: null, age: null, position: 'MF' })).not.toThrow();
  });
});

describe('playerSeasonReset', () => {
  it('resets to fresh-season defaults', () => {
    const reset = playerSeasonReset();
    expect(reset).toEqual({
      fatigue_points: 0,
      fatigue_level: 'fresh',
      form: 6.5,
      injured_until: null,
      suspended_matches: 0,
      season_goals: 0,
      season_assists: 0,
      season_apps: 0,
      season_minutes: 0,
    });
  });
});

describe('clubSeasonReset', () => {
  it('resets form/momentum/rating to null', () => {
    expect(clubSeasonReset()).toEqual({ form_string: null, momentum: null, current_rating: null });
  });
});
