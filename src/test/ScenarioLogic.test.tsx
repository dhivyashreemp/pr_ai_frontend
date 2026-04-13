import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import Index from "../pages/Index";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), 
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

const mockFormData = {
  metadata: {
    cr_number: "TEST-CR-001",
    part_number: "TEST-SKU-001",
    label_version: "REV-X",
    requested_by: "Test User"
  }
};

describe("Scenario Logic", () => {
  it("Index page should hide upload section when formData is present (Scenario 3)", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { formData: mockFormData } }]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    // DASHED boxes use label "UPLOAD" in Scenario 1
    expect(screen.queryByText("UPLOAD CURRENT VERSION LABEL")).not.toBeInTheDocument();
    expect(screen.queryByText("RUN COMPARATOR ANALYSIS")).not.toBeInTheDocument();
  });

  it("Index page should show upload section when formData is absent (Scenario 1)", () => {
    // Note: Need to mock state as empty
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: null }]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("UPLOAD CURRENT VERSION LABEL (PDF / IMAGE)")).toBeInTheDocument();
    expect(screen.getByText("RUN COMPARATOR ANALYSIS")).toBeInTheDocument();
  });

  it("Index page Navbar should show PROOFING ANALYSIS for Scenario 3", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { formData: mockFormData } }]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("PROOFING ANALYSIS")).toBeInTheDocument();
  });
});
