import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Index from "../pages/Index";
import CompareFormNew from "../pages/CompareFormNew";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
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

describe("Metadata Synchronization", () => {
  it("Index page should display snake_case metadata correctly", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { formData: mockFormData } }]}>
        <Routes>
          <Route path="/" element={<Index />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("TEST-CR-001")).toBeInTheDocument();
    expect(screen.getByText("TEST-SKU-001")).toBeInTheDocument();
    expect(screen.getByText("REV-X")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("CompareFormNew page should display snake_case metadata correctly", () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/', state: { formData: mockFormData, childFile: new File([], "test.png") } }]}>
        <Routes>
          <Route path="/" element={<CompareFormNew />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("TEST-CR-001")).toBeInTheDocument();
    expect(screen.getByText("TEST-SKU-001")).toBeInTheDocument();
    expect(screen.getByText("REV-X")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });
});
