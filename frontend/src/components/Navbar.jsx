import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut, User, Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/users', label: 'Users', permission: 'read:users' },
    { path: '/roles', label: 'Roles', permission: 'read:roles' },
    { path: '/permissions', label: 'Permissions', permission: 'read:permissions' },
    { path: '/documents', label: 'Documents', badge: 'ABAC', permission: 'read:documents' },
    { path: '/approvals', label: 'Approvals', badge: '4-Eyes', permission: 'read:approvals' },
    { path: '/audit', label: 'Audit Logs', permission: 'read:audit' },
  ];

  return (
    <nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-40 backdrop-blur-lg bg-opacity-95">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between min-h-[4.25rem] py-1.5 gap-2">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2.5 flex-shrink-0 group">
            <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-2 rounded-lg group-hover:scale-105 transition-transform">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-base sm:text-lg font-bold text-gradient leading-tight tracking-tight">
                RBAC System
              </span>
              <span className="text-[10px] text-primary-400 font-mono tracking-wider uppercase -mt-0.5">
                NIST RBAC1 + ABAC
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-1 flex-shrink-0">
            {navLinks.map((link) => {
              if (link.permission && !hasPermission(link.permission)) {
                return null;
              }

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-lg text-xs xl:text-sm font-medium transition-all whitespace-nowrap flex items-center ${
                    isActive(link.path)
                      ? 'bg-primary-600 text-white shadow-md shadow-primary-500/40'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <span>{link.label}</span>
                  {link.badge && (
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.2 rounded font-mono font-semibold ${
                      isActive(link.path)
                        ? 'bg-white/20 text-white'
                        : 'bg-primary-950 text-primary-300 border border-primary-700/60'
                    }`}>
                      {link.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Menu & ABAC Subject Badges */}
          <div className="hidden md:flex items-center space-x-3 flex-shrink-0">
            <div className="text-right">
              <p className="text-xs font-semibold text-gray-200 whitespace-nowrap leading-tight">
                {user?.fullName || user?.username}
              </p>
              <div className="flex items-center justify-end space-x-1.5 mt-1 whitespace-nowrap">
                <span className="text-[11px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded border border-gray-700 font-medium whitespace-nowrap">
                  {user?.department || 'General'}
                </span>
                <span className="text-[11px] bg-amber-950/80 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/80 font-mono font-medium whitespace-nowrap">
                  Clearance Lvl {user?.clearanceLevel || 1}
                </span>
              </div>
            </div>

            <div className="bg-primary-600 p-1.5 rounded-full flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>

            <button
              onClick={handleLogout}
              className="btn-secondary flex items-center space-x-1.5 text-xs px-3 py-1.5 whitespace-nowrap flex-shrink-0"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg hover:bg-gray-800 transition-colors text-gray-300"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-800 bg-gray-900 px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => {
            if (link.permission && !hasPermission(link.permission)) {
              return null;
            }
            return (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-md font-medium text-sm ${
                  isActive(link.path)
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <span>{link.label}</span>
                {link.badge && (
                  <span className="text-[10px] bg-primary-950 text-primary-300 border border-primary-700/60 px-1.5 py-0.5 rounded font-mono">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="pt-3 mt-2 border-t border-gray-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-200">{user?.fullName || user?.username}</div>
              <div className="flex items-center space-x-2 text-xs text-gray-400 mt-0.5">
                <span className="bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700">{user?.department || 'General'}</span>
                <span className="bg-amber-950 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800 font-mono">Clr Lvl {user?.clearanceLevel || 1}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="btn-secondary flex items-center space-x-1.5 text-xs px-3 py-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
