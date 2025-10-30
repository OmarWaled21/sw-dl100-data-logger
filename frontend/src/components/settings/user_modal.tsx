"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { useIP } from "@/lib/IPContext";

interface UserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (user: any) => Promise<void>;
  initialData?: any;
}

export default function UserModal({
  open,
  onOpenChange,
  onSave,
  initialData,
}: UserModalProps) {
  // استخدمت `any` هنا عشان نضيف department بدون مشاكل تايب
  const [form, setForm] = useState<any>({
    username: "",
    email: "",
    role: "",
    password: "",
    department: "",
  });
  const [loading, setLoading] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);

  const { t } = useTranslation();

  const { ipHost, ipLoading } = useIP();

  useEffect(() => {
    // read role from cookie once
    const role = Cookies.get("role");
    setCurrentUserRole(role || null);
  }, []);

  useEffect(() => {
    if (initialData) {
      // تأكد إن department يكون string لو لازم (Select بتستخدم string values)
      setForm({
        ...initialData,
        department: initialData?.department ?? "",
      });
    } else {
      setForm({ username: "", email: "", role: "", password: "", department: "" });
    }
  }, [initialData, open]);

  // جلب الأقسام فقط لو اليوزر Admin
  useEffect(() => {
    if (ipLoading) return;
    const token = Cookies.get("token");
    if (!token) return;

    if (currentUserRole === "admin") {
      axios
        .get(`https://${ipHost}/departments/`, {
          headers: { Authorization: `Token ${token}` },
        })
        .then((res) => {
          // نفترض ال API بترجع مصفوفة من { id, name }
          setDepartments(res.data || []);
        })
        .catch((err) => {
          console.error("Error fetching departments:", err);
        });
    }
  }, [currentUserRole, ipHost, ipLoading]);

  async function handleSubmit() {
    setLoading(true);
    try {
      // Important: if department is string id convert to number (backend may expect int)
      const payload = {
        ...form,
        department: form.department === "" ? null : (isNaN(Number(form.department)) ? form.department : Number(form.department)),
      };
      await onSave(payload);
    } finally {
      setLoading(false);
    }
  }

  const isEditing = !!initialData;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl shadow-xl border border-gray-200">
        {/* Header */}
        <DialogHeader className="pb-4 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${isEditing ? "bg-blue-50" : "bg-green-50"}`}>
              {isEditing ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">
                {isEditing ? `${t("Edit User")}` : `${t("Add New User")}`}
              </DialogTitle>
              <p className="text-sm text-gray-500 mt-1">
                {isEditing ? `${t("Update user information")}` : `${t("Create a new user account")}`}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Form Content */}
        <div className="py-6 space-y-5">
          {/* Username Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              {t("Username")}
            </label>
            <Input
              placeholder={t("Enter username")}
              dir="ltr"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              {t("Email Address")}
            </label>
            <Input
              placeholder={t("Enter email address")}
              dir="ltr"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
            />
          </div>

          {/* Role Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              {t("User Role")}
            </label>
            <Select
              onValueChange={(v) => setForm({ ...form, role: v })}
              value={form.role}
            >
              <SelectTrigger className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                <SelectValue placeholder={`${t("Select user role")}`} />
              </SelectTrigger>
              <SelectContent className="bg-white border border-gray-200 rounded-xl shadow-lg">
                <SelectItem value="user" className="flex items-center p-3">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{t("user")}</span>
                  </div>
                </SelectItem>
                <SelectItem value="supervisor" className="flex items-center p-3">
                  <div className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>{t("supervisor")}</span>
                  </div>
                </SelectItem>
                {currentUserRole === "admin" && (
                  <SelectItem value="manager" className="flex items-center p-3">
                    <div className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4m-2 4h.01M12 20a8 8 0 100-16 8 8 0 000 16z" />
                      </svg>
                      <span>{t("manager")}</span>
                    </div>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Department Field - يظهر فقط للـ Admin */}
          {currentUserRole === "admin" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                </svg>
                {t("department")}
              </label>
              <Select
                onValueChange={(v) => setForm({ ...form, department: v })}
                value={form.department ? String(form.department) : ""}
              >
                <SelectTrigger className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all">
                  <SelectValue placeholder={t("Select department")} />
                </SelectTrigger>
                <SelectContent className="bg-white border border-gray-200 rounded-xl shadow-lg">
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Password Field - Only for new users */}
          {!isEditing && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                {t("Password")}
              </label>
              <Input
                placeholder={t("Enter password")}
                type="password"
                dir="ltr"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              <p className="text-xs text-gray-500">
                {t("Create a strong password with at least 8 characters")}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="pt-4 border-t border-gray-100">
          <div className="flex space-x-3 w-full">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {t("Cancel")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                loading ||
                !form.username ||
                !form.email ||
                !form.role ||
                (currentUserRole === "admin" && !form.department) ||
                (!isEditing && !form.password)
              }
              className={`flex-1 transition-all cursor-pointer ${
                isEditing
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  : "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              }`}
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {isEditing ? "Updating..." : "Creating..."}
                </div>
              ) : (
                isEditing ? t("Update User") : t("Create User")
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
