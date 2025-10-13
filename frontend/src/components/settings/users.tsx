"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "js-cookie";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import UserModal from "@/components/settings/user_modal";
import { User } from "@/types/user";

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loading, setLoading] = useState(false);

  // modal state
  const [openModal, setOpenModal] = useState(false);
  const [editUser, setEditUser] = useState<User | undefined>(undefined);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await axios.get("http://127.0.0.1:8000/users/", {
        headers: { Authorization: `Token ${Cookies.get("token")}` },
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Error loading users", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveUser(user: User) {
    try {
      if (user.user_id) {
        await axios.put(`http://127.0.0.1:8000/users/${user.user_id}/edit/`, user, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${Cookies.get("token")}`,
          },
        });

        fetch("http://127.0.0.1:8000/logs/create/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${Cookies.get("token")}`,
          },
          body: JSON.stringify({
            action: `Edit user`,
            message: `${Cookies.get("username")} Edited user ${user.username}`,
          })
        }).catch(console.error);
      } else {
        await axios.post("http://127.0.0.1:8000/users/add/", user, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${Cookies.get("token")}`,
          },
        });

        fetch("http://127.0.0.1:8000/logs/create/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${Cookies.get("token")}`,
          },
          body: JSON.stringify({
            action: `Add user`,
            message: `${Cookies.get("username")} Added new user ${user.username}`,
          })
        }).catch(console.error);
      }
      setOpenModal(false);
      fetchUsers();
    } catch (err) {
      console.error("Error saving user", err);
    }
  }

  async function handleDeleteUser(user: User) {
    if (!confirm("Are you sure you want to delete this user?")) return;

    try {
      await axios.delete(`http://127.0.0.1:8000/users/${user.user_id}/delete/`, {
        headers: { Authorization: `Token ${Cookies.get("token")}` },
      });

      fetch("http://127.0.0.1:8000/logs/create/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Token ${Cookies.get("token")}`,
          },
          body: JSON.stringify({
            action: `Delete user`,
            message: `${Cookies.get("username")} Deleted user ${user.username}`,
          })
        }).catch(console.error);
      fetchUsers();
    } catch (err) {
      console.error("Error deleting user", err);
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      (roleFilter && roleFilter !== "all" ? u.role === roleFilter : true) &&
      (search
        ? u.username.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
        : true)
  );

  return (
    <div className=" bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div className="mb-4 sm:mb-0">
              <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
              <p className="text-gray-600 mt-2">Manage system users and their permissions</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="bg-blue-50 rounded-lg p-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <span className="text-sm text-gray-500">{filteredUsers.length} users</span>
            </div>
          </div>
        </div>

        {/* Filters + Add Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Input
                  placeholder="Search users by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                />
                <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              <Select onValueChange={(v) => setRoleFilter(v)} value={roleFilter}>
                <SelectTrigger className="w-full sm:w-48 bg-gray-50 border-gray-200 focus:bg-white transition-colors">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={() => {
                setEditUser(undefined);
                setOpenModal(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-sm cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add New User
            </Button>
          </div>
        </div>

        {/* Table Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-50 rounded-full mb-4">
                  <svg className="animate-spin h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">Loading users...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Grouped Table by Department */}
              {Object.entries(
                filteredUsers
                  .sort((a, b) => {
                    // ترتيب حسب department (مع معالجة احتمالية undefined)
                    const deptA = a.department_name ?? "";
                    const deptB = b.department_name ?? "";
                    if (deptA < deptB) return -1;
                    if (deptA > deptB) return 1;

                    // ترتيب داخلي حسب role
                    const roleOrder: Record<string, number> = { manager: 1, supervisor: 2, user: 3 };
                    return (roleOrder[a.role] ?? 99) - (roleOrder[b.role] ?? 99);
                  })
                  .reduce((groups: Record<string, typeof filteredUsers>, user) => {
                    const dept = user.department_name || "No Department";
                    if (!groups[dept]) groups[dept] = [];
                    groups[dept].push(user);
                    return groups;
                  }, {})
              ).map(([dept, usersInDept]: [string, typeof filteredUsers]) => (
                <div key={dept} className="mb-10">
                  {/* عنوان القسم */}
                  <h2 className="text-xl font-semibold text-gray-800 mb-4 border-b border-gray-200 pb-2 px-4">
                    {dept}
                  </h2>

                  {/* الجدول الخاص بكل قسم */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableCell className="font-semibold text-gray-900 py-4">Username</TableCell>
                          <TableCell className="font-semibold text-gray-900 py-4">Email</TableCell>
                          <TableCell className="font-semibold text-gray-900 py-4">Role</TableCell>
                          <TableCell className="font-semibold text-gray-900 py-4 text-right">Actions</TableCell>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {usersInDept.map((u: typeof filteredUsers[number]) => (
                          <TableRow
                            key={u.user_id}
                            className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <TableCell className="py-4 font-medium text-gray-900">{u.username}</TableCell>
                            <TableCell className="py-4 text-gray-600">{u.email}</TableCell>
                            <TableCell className="py-4">
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                  u.role === "manager"
                                    ? "bg-purple-100 text-purple-800"
                                    : u.role === "supervisor"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-green-100 text-green-800"
                                }`}
                              >
                                {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                              </span>
                            </TableCell>
                            <TableCell className="py-4">
                              <div className="flex justify-end space-x-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-gray-300 hover:bg-gray-50 cursor-pointer"
                                  onClick={() => {
                                    setEditUser(u);
                                    setOpenModal(true);
                                  }}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  className="cursor-pointer"
                                  variant="destructive"
                                  onClick={() => u.user_id && handleDeleteUser(u)}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}

            </>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500">
            Showing {filteredUsers.length} of {users.length} users
          </p>
        </div>
      </div>

      {/* Modal */}
      <UserModal
        open={openModal}
        onOpenChange={setOpenModal}
        onSave={handleSaveUser}
        initialData={editUser}
      />
    </div>
  );
}