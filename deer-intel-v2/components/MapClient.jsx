"use client";

import dynamic from "next/dynamic";

const HuntingMap = dynamic(() => import("./HuntingMap"), {
  ssr: false,
});

export default function MapClient() {
  return <HuntingMap />;
}