import { type HTMLAttributes, type ReactNode } from "react";


interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const Card = ({
  className = "",
  children,
  ...props
}: CardProps) => {
    return (
      <div
        className={`rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm ${className}`}
        {...props}
      >
        {children}
      </div>
    );
};

Card.displayName = "Card";

interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader = ({
  className = "",
  children,
  ...props
}: CardHeaderProps) => {
    return (
      <div
        className={`flex flex-col space-y-1.5 p-6 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
};

CardHeader.displayName = "CardHeader";

interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export const CardTitle = ({
  className = "",
  children,
  ...props
}: CardTitleProps) => {
    return (
      <h3
        className={`text-2xl font-semibold leading-none tracking-tight ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
};

CardTitle.displayName = "CardTitle";

interface CardDescriptionProps
  extends HTMLAttributes<HTMLParagraphElement> {
  children: ReactNode;
}

export const CardDescription = ({
  className = "",
  children,
  ...props
}: CardDescriptionProps) => {
  return (
    <p
      className={`text-sm text-muted-foreground ${className}`}
      {...props}
    >
      {children}
    </p>
  );
};

CardDescription.displayName = "CardDescription";

interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardContent = ({
  className = "",
  children,
  ...props
}: CardContentProps) => {
    return (
      <div className={`p-6 pt-0 ${className}`} {...props}>
        {children}
      </div>
    );
};

CardContent.displayName = "CardContent";

interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardFooter = ({
  className = "",
  children,
  ...props
}: CardFooterProps) => {
    return (
      <div
        className={`flex items-center p-6 pt-0 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
};

CardFooter.displayName = "CardFooter";
