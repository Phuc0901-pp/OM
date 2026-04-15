import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';

interface ModernInputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    description?: string;
    icon?: ReactNode;
    error?: string;
    containerClassName?: string;
}

const ModernInput = forwardRef<HTMLInputElement, ModernInputProps>(
    ({ className = '', label, description, icon, error, containerClassName = '', ...props }, ref) => {
        return (
            <div className={`space-y-1.5 ${containerClassName}`}>
                {label && (
                    <label className="block text-sm font-semibold text-slate-700 ml-1">
                        {label}
                    </label>
                )}

                <div className="relative group">
                    {icon && (
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors text-slate-400 group-focus-within:text-primary-500">
                            {icon}
                        </div>
                    )}

                    <input
                        ref={ref}
                        className={`
                            block w-full 
                            ${icon ? 'pl-11' : 'pl-4'} pr-4 
                            py-2.5 
                            bg-white/60 backdrop-blur-sm
                            border border-slate-200 
                            rounded-xl 
                            text-slate-800 placeholder-slate-400 
                            transition-all duration-200 
                            outline-none 
                            hover:bg-white/80
                            focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500
                            disabled:opacity-50 disabled:cursor-not-allowed
                            ${error ? 'border-red-300 focus:border-red-500 focus:ring-red-500/20' : ''}
                            ${className}
                        `}
                        {...props}
                    />
                </div>

                {description && !error && (
                    <p className="text-xs text-slate-500 ml-1">{description}</p>
                )}

                {error && (
                    <p className="text-xs text-red-500 font-medium ml-1 animate-slide-in">{error}</p>
                )}
            </div>
        );
    }
);

ModernInput.displayName = 'ModernInput';

export default ModernInput;
