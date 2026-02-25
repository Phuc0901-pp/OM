import { useState, useEffect } from 'react';
import DesktopLogin from './desktop/DesktopLogin';
import MobileLogin from './mobile/MobileLogin';

const useIsMobile = () => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 1024);
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
};

const LoginPage = () => {
    const isMobile = useIsMobile();

    return isMobile ? <MobileLogin /> : <DesktopLogin />;
};

export default LoginPage;
