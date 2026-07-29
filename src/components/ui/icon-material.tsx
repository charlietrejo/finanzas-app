"use client";

import React from "react";

export default function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-icons ${className ?? ""}`}>{name}</span>;
}
