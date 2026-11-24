import {
  ChevronDown,
  BadgeCheck,
  Banknote,
  BriefcaseBusiness,
  CalendarDays,
  Clock,
  Globe,
  House,
  MapPin,
  Plane,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import {
  preferenceFields,
  type GeneralPreferenceData,
} from "../../api/application-preferences";

type Data = GeneralPreferenceData;
type Field = keyof Data;
type Props = { data: Data; onChange: (data: Data) => void };

const countryCodes =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " ",
  );
const regions = new Intl.DisplayNames(["en"], { type: "region" });
const countryOptions = countryCodes
  .map((code) => regions.of(code)!)
  .sort((a, b) => a.localeCompare(b));
const currencies = new Intl.DisplayNames(["en"], { type: "currency" });
const currencyOptions = Intl.supportedValuesOf("currency").map((code) => ({
  value: code,
  label: code + " — " + (currencies.of(code) ?? code),
}));

function Caption({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: string;
}) {
  return (
    <span className="preference-caption">
      <Icon size={16} aria-hidden="true" />
      {children}
    </span>
  );
}

function Choice({
  field,
  icon,
  options,
  data,
  onChange,
}: Props & {
  field: Field;
  icon: LucideIcon;
  options: readonly (string | { value: string; label: string })[];
}) {
  const value = data[field] ?? "";
  const choices = options.map((option) =>
    typeof option === "string" ? { value: option, label: option } : option,
  );
  return (
    <label>
      <Caption icon={icon}>{preferenceFields[field]}</Caption>
      <span className="preference-select">
        <select
          value={value}
          onChange={(event) =>
            onChange({ ...data, [field]: event.target.value })
          }
        >
          <option value="">Not specified</option>
          {value && !choices.some((option) => option.value === value) && (
            <option value={value}>{value} (saved value)</option>
          )}
          {choices.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </span>
    </label>
  );
}

function MultipleChoice({
  field,
  icon,
  options,
  data,
  onChange,
}: Props & {
  field: Field;
  icon: LucideIcon;
  options: readonly string[];
}) {
  const value = data[field] ?? "";
  const parts = value ? value.split(", ") : [];
  const selected = parts.every((part) => options.includes(part))
    ? parts
    : value
      ? [value]
      : [];
  const choices = [
    ...options,
    ...selected.filter((part) => !options.includes(part)),
  ];
  return (
    <fieldset className="preference-options">
      <legend>
        <Caption icon={icon}>{preferenceFields[field]}</Caption>
      </legend>
      <label>
        <input
          type="checkbox"
          checked={selected.length === 0}
          onChange={() => onChange({ ...data, [field]: "" })}
        />
        Not specified
      </label>
      {choices.map((option) => (
        <label key={option}>
          <input
            type="checkbox"
            checked={selected.includes(option)}
            onChange={(event) =>
              onChange({
                ...data,
                [field]: (event.target.checked
                  ? [...selected, option]
                  : selected.filter((part) => part !== option)
                ).join(", "),
              })
            }
          />
          {option}
        </label>
      ))}
    </fieldset>
  );
}

export function PreferenceInputs({ data, onChange }: Props) {
  const props = { data, onChange };
  function input(
    field: Field,
    type = "text",
    extra: { min?: string; step?: string } = {},
  ) {
    return (
      <input
        type={type}
        maxLength={1000}
        value={data[field] ?? ""}
        {...extra}
        onChange={(event) => onChange({ ...data, [field]: event.target.value })}
      />
    );
  }
  return (
    <>
      <fieldset className="preference-section">
        <legend>
          <Caption icon={Globe}>Employment eligibility</Caption>
        </legend>
        <div className="preference-fields-grid">
          <Choice
            {...props}
            field="country"
            icon={Globe}
            options={countryOptions}
          />
          <Choice
            {...props}
            field="workAuthorization"
            icon={BadgeCheck}
            options={["Authorized", "Not authorized", "Unsure"]}
          />
          <Choice
            {...props}
            field="sponsorship"
            icon={BriefcaseBusiness}
            options={[
              "Required now",
              "Required in future",
              "Not required",
              "Unsure",
            ]}
          />
        </div>
      </fieldset>
      <fieldset className="preference-section">
        <legend>
          <Caption icon={Wallet}>Salary expectations</Caption>
        </legend>
        <div className="preference-input-row">
          <label>
            Minimum salary
            {input("salaryMinimum", "number", { min: "0", step: "0.01" })}
          </label>
          <label>
            Maximum salary
            {input("salaryMaximum", "number", {
              min: data.salaryMinimum || "0",
              step: "0.01",
            })}
          </label>
        </div>
        <Choice
          {...props}
          field="currency"
          icon={Banknote}
          options={currencyOptions}
        />
        <Choice
          {...props}
          field="salaryPeriod"
          icon={Clock}
          options={["Per year", "Per month", "Per week", "Per day", "Per hour"]}
        />
        <label>Salary notes (optional){input("salary")}</label>
      </fieldset>
      <fieldset className="preference-section">
        <legend>
          <Caption icon={CalendarDays}>Availability</Caption>
        </legend>
        <Choice
          {...props}
          field="availabilityType"
          icon={Clock}
          options={[
            "Immediately",
            "Notice period",
            "Specific date",
            "Negotiable",
          ]}
        />
        <label>Earliest start date{input("startDate", "date")}</label>
        <div className="preference-input-row">
          <label>
            Notice period
            {input("noticePeriod", "number", { min: "0", step: "1" })}
          </label>
          <Choice
            {...props}
            field="noticeUnit"
            icon={Clock}
            options={["Days", "Weeks", "Months"]}
          />
        </div>
        <label>Availability notes (optional){input("availability")}</label>
      </fieldset>
      <fieldset className="preference-section">
        <legend>
          <Caption icon={BriefcaseBusiness}>Work preferences</Caption>
        </legend>
        <Choice
          {...props}
          field="relocation"
          icon={MapPin}
          options={["Yes", "No", "Depends on location"]}
        />
        <MultipleChoice
          {...props}
          field="workArrangement"
          icon={House}
          options={["Remote", "Hybrid", "Onsite"]}
        />
        <Choice
          {...props}
          field="travel"
          icon={Plane}
          options={[
            "None",
            "Up to 25%",
            "Up to 50%",
            "Up to 75%",
            "Unrestricted",
          ]}
        />
        <MultipleChoice
          {...props}
          field="employmentType"
          icon={BriefcaseBusiness}
          options={[
            "Full-time",
            "Part-time",
            "Contract",
            "Temporary",
            "Internship",
          ]}
        />
      </fieldset>
    </>
  );
}
