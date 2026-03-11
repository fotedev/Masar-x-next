interface FooterSupportProps {
  tFooter: any;
  whatsappUrl: string;
}

export function FooterSupport({ tFooter, whatsappUrl }: FooterSupportProps) {
  return (
    <div>
      <h3 className="text-slate-900 dark:text-white font-bold mb-4 text-lg">
        {tFooter("support")}
      </h3>
      <div className="space-y-3">
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          {tFooter("supportPrompt")}
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-6 py-3 bg-[#25D366] hover:bg-[#20ba5a] text-white rounded-2xl transition-all duration-300 font-bold text-sm shadow-lg shadow-green-500/20 group"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 19 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="transition-transform group-hover:scale-110"
          >
            <path
              d="M15.255 3.713a8 8 0 0 0-5.684-2.36c-4.433 0-8.043 3.603-8.043 8.036 0 1.394.364 2.771 1.045 3.974l-1.164 4.26 4.354-1.14a8.06 8.06 0 0 0 3.8.957c4.434 0 8.044-3.61 8.044-8.043 0-2.145-.84-4.172-2.352-5.692zM4.283 13.11c-.76-.863-1.18-2.312-1.18-3.72a6.467 6.467 0 0 1 6.46-6.46 6.42 6.42 0 0 1 4.568 1.891 6.42 6.42 0 0 1 1.892 4.568 6.467 6.467 0 0 1-6.46 6.46c-1.258 0-2.596-.404-3.562-1.06l-2.343.609z"
              fill="currentColor"
            ></path>
            <path
              d="M11.748 10.434c.182.064 1.148.539 1.346.641.198.103.333.15.38.23.048.08.048.475-.119.934s-.95.879-1.33.934c-.34.048-.768.072-1.242-.079a12 12 0 0 1-1.125-.412c-1.979-.854-3.27-2.842-3.364-2.976-.103-.143-.8-1.069-.8-2.035s.507-1.448.689-1.646a.72.72 0 0 1 .522-.246h.38c.12 0 .285-.047.444.34.166.396.562 1.362.61 1.465a.38.38 0 0 1 .015.349c-.063.134-.095.213-.198.324a8 8 0 0 1-.293.348c-.095.095-.198.206-.087.404.119.198.507.84 1.093 1.362.752.673 1.385.879 1.583.974s.309.079.428-.048c.118-.135.49-.578.625-.776s.261-.166.443-.095z"
              fill="currentColor"
            ></path>
          </svg>
          <span>{tFooter("contact")}</span>
        </a>
      </div>
    </div>
  );
}
