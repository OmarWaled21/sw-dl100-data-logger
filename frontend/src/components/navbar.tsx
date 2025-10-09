"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import Cookies from "js-cookie";

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAuth, setIsAuth] = useState(false);

  const { t, i18n } = useTranslation();
  const [mounted, setMounted] = useState(false);

  const router = useRouter();
  const pathname = usePathname();

  const toggleLang = () => {
    const newLang = i18n.language === "en" ? "ar" : "en";
    i18n.changeLanguage(newLang);
    Cookies.set("i18next", newLang, { expires: 365 });
    router.refresh();
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkAuth = () => {
      const token = Cookies.get("token") || sessionStorage.getItem("token");
      setIsAuth(!!token);
    };

    checkAuth();

    window.addEventListener("authChanged", checkAuth);
    return () => window.removeEventListener("authChanged", checkAuth);
  }, []);

  const role = Cookies.get("role"); // جايبنا الدور من الكوكيز

  const allLinks = [
    { name: t("Dashboard"), href: "/", roles: ["admin", "supervisor", "manager", "user"] },
    { name: t("Logs"), href: "/logs/", roles: ["admin", "supervisor", "manager"] },
    { name: t("Settings"), href: "/settings/", roles: ["admin", "manager"] },
  ];

  // فلترة الروابط حسب الدور
  const links = allLinks.filter(link => role && link.roles.includes(role));

  const handleLogout = async () => {
    const token = Cookies.get("token");
    const username = Cookies.get("username");
    try {
      if (token) { 
        await fetch("http://127.0.0.1:8000/logs/create/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
          body: JSON.stringify({
            action: "logged out",
            message: `User ${username || "Unknown"} logged out`,
          }),
        }).catch(console.error);

        await fetch("http://127.0.0.1:8000/auth/logout/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }

    Cookies.remove("token");
    setIsAuth(false);
    router.push("/auth/login");
  };

  // إصلاح active link
  const cleanPathname = pathname === "/" ? "/" : pathname.replace(/\/$/, "");

  return (
    <nav
      className="text-white sticky top-0 shadow-md z-50"
      style={{ backgroundColor: "#212529" }}
    >
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <img
            src="/tomatiki_logo_dark_theme.png"
            alt="Logo"
            className="w-28 md:w-36 lg:w-40 h-auto"
          />
        </Link>

        {/* Title */}
        <h3 className="hidden md:block text-lg lg:text-3xl font-semibold text-white text-center flex-grow">
          {mounted ? t("Data Logger") : ""}
        </h3>

        {/* Language Toggle */}
        <div className="hidden md:flex items-center">
          <button
            onClick={toggleLang}
            className="mx-2 px-3 py-1 border rounded hover:bg-white/10 transition cursor-pointer mr-4"
          >
            {mounted ? (i18n.language === "en" ? "عربي" : "English") : "English"}
          </button>
        </div>

        {/* Links & Logout */}
        {isAuth && (
          <>
            {/* Desktop Links */}
            <ul className="hidden md:flex items-center space-x-4">
              {links.map((item) => {
                const cleanHref = item.href === "/" ? "/" : item.href.replace(/\/$/, "");
                const isActive = cleanPathname === cleanHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`relative block px-4 py-2 rounded transition group hover:bg-white/10 
                        ${isActive ? "border-b-2 border-red-400" : ""}`}
                    >
                      {item.name}
                    </Link>
                  </li>
                );
              })}

              {/* Logout */}
              <li>
                <button
                  onClick={handleLogout}
                  className="relative block px-4 py-2 rounded hover:bg-white/10 transition text-red-400 cursor-pointer"
                >
                  {t("Logout")}
                </button>
              </li>
            </ul>

            {/* Mobile Toggler */}
            <button
              className="md:hidden focus:outline-none"
              onClick={() => setIsOpen(!isOpen)}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={
                    isOpen
                      ? "M6 18L18 6M6 6l12 12"
                      : "M4 6h16M4 12h16M4 18h16"
                  }
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Mobile Links */}
      {isAuth && isOpen && mounted && (
        <div className="md:hidden px-4 pb-4">
          <ul className="space-y-2">
            {links.map((item) => {
              const cleanHref = item.href === "/" ? "/" : item.href.replace(/\/$/, "");
              const isActive = cleanPathname === cleanHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`block px-4 py-2 rounded hover:bg-white/10 transition 
                      ${isActive ? "border-b-2 border-red-400" : ""}`}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}

            {/* Mobile Logout */}
            <li>
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 rounded hover:bg-white/10 transition text-red-400"
              >
                {t("Logout")}
              </button>
            </li>

            {/* Mobile Language Toggle */}
            <li>
              <button
                onClick={toggleLang}
                className="block w-full text-left px-4 py-2 rounded hover:bg-white/10 transition border-t mt-2"
              >
                {i18n.language === "en" ? "عربي" : "English"}
              </button>
            </li>
          </ul>
        </div>
      )}
    </nav>
  );
}
