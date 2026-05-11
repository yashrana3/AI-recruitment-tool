import React from "react";
import GridShape from "../../components/common/GridShape";
import { Link } from "react-router";
import ThemeTogglerTwo from "../../components/common/ThemeTogglerTwo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative p-6 bg-gradient-to-br from-gray-50 to-gray-100 z-1 dark:bg-gradient-to-br dark:from-gray-900 dark:to-gray-800 sm:p-0">
      <div className="relative flex flex-col justify-center w-full h-screen lg:flex-row sm:p-0">
        {children}
        <div className="items-center hidden w-full h-full lg:w-1/2 bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 lg:grid relative overflow-hidden">
          {/* Animated gradient orbs */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

          <div className="relative flex items-center justify-center z-10">
            {/* Grid Shape Background */}
            <GridShape />

            <div className="flex flex-col items-center max-w-xl px-8">
              {/* Logo */}
              <Link to="/" className="block mb-8 transform transition-transform hover:scale-105 duration-300">
                <img
                  width={210}
                  height={38}
                  src="/images/logo/logo.jpeg"
                  alt="Logo"
                  className="drop-shadow-2xl"
                />
              </Link>

              {/* Company Name - Larger and More Prominent */}
              <div className="text-center space-y-3">
                <h1 className="text-4xl md:text-5xl font-bold text-white dark:text-white leading-tight">
                  NTek Solutions
                </h1>
                <div className="flex items-center justify-center gap-2">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent via-brand-400 to-transparent"></div>
                  <p className="text-lg md:text-2xl text-brand-200 dark:text-gray-300 font-medium">
                    AI Recruitment Tool
                  </p>
                  <div className="h-px w-12 bg-gradient-to-r from-transparent via-brand-400 to-transparent"></div>
                </div>
                <p className="text-sm text-brand-300/80 dark:text-gray-400 mt-4 max-w-md">
                  Revolutionizing talent acquisition with intelligent automation and data-driven insights
                </p>
              </div>

              {/* Decorative dots */}
              <div className="flex gap-2 mt-8">
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce"></div>
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 rounded-full bg-brand-400 animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        </div>
        <div className="fixed z-50 hidden bottom-6 right-6 sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
