export type Language = 'vi' | 'en';

export const translations = {
    vi: {
        // General
        'app.name': 'Raitek O&M',
        'common.loading': 'Đang tải...',
        'common.error': 'Có lỗi xảy ra',
        'common.save': 'Lưu',
        'common.cancel': 'Hủy',
        'common.edit': 'Chỉnh sửa',
        'common.delete': 'Xóa',
        'common.search': 'Tìm kiếm...',

        // Sidebar
        'sidebar.dashboard': 'Tổng quan',
        'sidebar.profile': 'Hồ sơ',
        'sidebar.management': 'Quản lý',
        'sidebar.reports': 'Báo cáo',
        'sidebar.operations': 'Vận hành',
        'sidebar.database': 'Cơ sở dữ liệu',
        'sidebar.allocation': 'Phân bổ',
        'sidebar.personnel': 'Nhân sự',
        'sidebar.history': 'Lịch sử',
        'sidebar.environment': 'Môi trường làm việc',
        'sidebar.statistics': 'Thống kê',
        'sidebar.settings': 'Cài đặt',
        'sidebar.logout': 'Đăng xuất',

        // Settings Page
        'settings.title': 'Cài đặt',
        'settings.subtitle': 'Quản lý thông tin cá nhân và tùy chọn',
        'settings.profile.title': 'Thông tin hồ sơ',
        'settings.role': 'Vai trò',
        'settings.team': 'Nhóm',
        'settings.joined': 'Tham gia',
        'settings.password.title': 'Đổi mật khẩu',
        'settings.password.current': 'Mật khẩu hiện tại',
        'settings.password.new': 'Mật khẩu mới',
        'settings.password.confirm': 'Xác nhận mật khẩu mới',
        'settings.password.update': 'Cập nhật mật khẩu',
        'settings.preferences.title': 'Tùy chọn',
        'settings.notifications': 'Thông báo',
        'settings.notifications.desc': 'Nhận thông báo cho các cập nhật mới',
        'settings.darkmode': 'Chế độ tối',
        'settings.darkmode.desc': 'Bật giao diện tối cho trải nghiệm tốt hơn vào ban đêm',
        'settings.language': 'Ngôn ngữ',
        'settings.language.desc': 'Chọn ngôn ngữ hiển thị',
    },
    en: {
        // General
        'app.name': 'Raitek O&M',
        'common.loading': 'Loading...',
        'common.error': 'An error occurred',
        'common.save': 'Save',
        'common.cancel': 'Cancel',
        'common.edit': 'Edit',
        'common.delete': 'Delete',
        'common.search': 'Search...',

        // Sidebar
        'sidebar.dashboard': 'Dashboard',
        'sidebar.profile': 'Profile',
        'sidebar.management': 'Management',
        'sidebar.reports': 'Reports',
        'sidebar.operations': 'Operations',
        'sidebar.database': 'Database',
        'sidebar.allocation': 'Allocation',
        'sidebar.personnel': 'Personnel',
        'sidebar.history': 'History',
        'sidebar.environment': 'Work Environment',
        'sidebar.statistics': 'Statistics',
        'sidebar.settings': 'Settings',
        'sidebar.logout': 'Logout',

        // Settings Page
        'settings.title': 'Settings',
        'settings.subtitle': 'Manage personal information and preferences',
        'settings.profile.title': 'Profile Information',
        'settings.role': 'Role',
        'settings.team': 'Team',
        'settings.joined': 'Joined',
        'settings.password.title': 'Change Password',
        'settings.password.current': 'Current Password',
        'settings.password.new': 'New Password',
        'settings.password.confirm': 'Confirm New Password',
        'settings.password.update': 'Update Password',
        'settings.preferences.title': 'Preferences',
        'settings.notifications': 'Notifications',
        'settings.notifications.desc': 'Receive notifications for new updates',
        'settings.darkmode': 'Dark Mode',
        'settings.darkmode.desc': 'Enable dark interface for better night experience',
        'settings.language': 'Language',
        'settings.language.desc': 'Choose display language',
    }
};

export type TranslationKey = keyof typeof translations['vi'];
