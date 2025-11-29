// app/api/portfolio-images/route.ts
import { readdirSync } from "fs";
import { join } from "path";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const portfolioDir = join(process.cwd(), "public", "testingPortfolio");
    
    const files = readdirSync(portfolioDir);
    
    // Filter for image files only
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
    const images = files
      .filter(file => imageExtensions.some(ext => file.toLowerCase().endsWith(ext)))
      .map(file => `/testingPortfolio/${file}`);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error reading portfolio directory:", error);
    return NextResponse.json({ images: [], error: "Failed to load images" }, { status: 500 });
  }
}