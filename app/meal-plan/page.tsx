"use client";

import Link from "next/link";
import { CalendarDays, ChefHat, Dumbbell, Flame, Target, UtensilsCrossed } from "lucide-react";

const mealDays = [
  {
    day: "Monday",
    type: "Training Day",
    calories: "2,350 kcal",
    meals: [
      "Breakfast — Greek yogurt, oats, berries, chia",
      "Lunch — Chicken rice bowl with greens",
      "Snack — Banana + peanut butter",
      "Dinner — Salmon, potatoes, broccoli",
    ],
  },
  {
    day: "Tuesday",
    type: "Light Day",
    calories: "2,100 kcal",
    meals: [
      "Breakfast — Eggs on toast with avocado",
      "Lunch — Turkey wrap with salad",
      "Snack — Protein yogurt",
      "Dinner — Lean beef, rice, vegetables",
    ],
  },
  {
    day: "Wednesday",
    type: "Training Day",
    calories: "2,400 kcal",
    meals: [
      "Breakfast — Protein oats with banana",
      "Lunch — Pasta with chicken and tomato sauce",
      "Snack — Rice cakes + cottage cheese",
      "Dinner — Stir fry chicken and vegetables",
    ],
  },
  {
    day: "Thursday",
    type: "Recovery Day",
    calories: "2,050 kcal",
    meals: [
      "Breakfast — Smoothie bowl",
      "Lunch — Tuna salad bowl",
      "Snack — Apple + almonds",
      "Dinner — Turkey mince with roasted vegetables",
    ],
  },
  {
    day: "Friday",
    type: "Training Day",
    calories: "2,450 kcal",
    meals: [
      "Breakfast — Eggs, oats, fruit",
      "Lunch — Chicken burrito bowl",
      "Snack — Protein shake",
      "Dinner — Steak, sweet potato, salad",
    ],
  },
  {
    day: "Saturday",
    type: "Training Day",
    calories: "2,300 kcal",
    meals: [
      "Breakfast — Pancakes with yogurt",
      "Lunch — Pasta salad with chicken",
      "Snack — Mixed nuts + fruit",
      "Dinner — Homemade burger bowl",
    ],
  },
  {
    day: "Sunday",
    type: "Rest Day",
    calories: "2,000 kcal",
    meals: [
      "Breakfast — Scrambled eggs + toast",
      "Lunch — Soup + sandwich",
      "Snack — Cottage cheese + berries",
      "Dinner — Grilled chicken and vegetables",
    ],
  },
];

export default function MealPlanPage() {
  return (
    <div className="mealPlanPage">
      <section className="hero">
        <div className="heroText">
          <span className="eyebrow">Meal planning</span>
          <h1>Your weekly meal plan</h1>
          <p>
            Keep your food plan separate from recipes and training, with a clean weekly structure you can update later
            with dynamic data.
          </p>

          <div className="heroActions">
            <Link href="/recipes" className="primaryBtn">
              <ChefHat size={16} />
              Browse Recipes
            </Link>
            <Link href="/fitness" className="secondaryBtn">
              <Dumbbell size={16} />
              Open Training
            </Link>
          </div>
        </div>

        <div className="summaryGrid">
          <div className="summaryCard">
            <CalendarDays size={18} />
            <div>
              <strong>7 day plan</strong>
              <span>Organised by day</span>
            </div>
          </div>

          <div className="summaryCard">
            <Flame size={18} />
            <div>
              <strong>Goal aligned</strong>
              <span>Calories per day</span>
            </div>
          </div>

          <div className="summaryCard">
            <Target size={18} />
            <div>
              <strong>Training synced</strong>
              <span>More food on workout days</span>
            </div>
          </div>
        </div>
      </section>

      <section className="weekGrid">
        {mealDays.map((item) => (
          <article key={item.day} className="dayCard">
            <div className="dayHead">
              <div>
                <h2>{item.day}</h2>
                <p>{item.type}</p>
              </div>
              <span className="caloriePill">{item.calories}</span>
            </div>

            <div className="mealList">
              {item.meals.map((meal) => (
                <div key={meal} className="mealRow">
                  <UtensilsCrossed size={15} />
                  <span>{meal}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <style jsx>{`
        .mealPlanPage {
          width: min(1180px, 100%);
          margin: 0 auto;
          padding: 28px 24px 40px;
          display: grid;
          gap: 24px;
        }

        .hero {
          display: grid;
          grid-template-columns: 1.2fr 0.9fr;
          gap: 20px;
        }

        .heroText,
        .summaryGrid,
        .dayCard {
          border: 1px solid var(--border);
          background: var(--bg-raised);
          border-radius: 24px;
          box-shadow: var(--shadow);
        }

        .heroText {
          padding: 28px;
        }

        .eyebrow {
          display: inline-block;
          margin-bottom: 8px;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--primary);
        }

        .heroText h1 {
          margin: 0 0 10px;
          font-size: clamp(28px, 4vw, 44px);
          line-height: 1.05;
        }

        .heroText p {
          max-width: 680px;
          margin-bottom: 18px;
        }

        .heroActions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .primaryBtn,
        .secondaryBtn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          border-radius: 14px;
          font-weight: 700;
          text-decoration: none;
        }

        .primaryBtn {
          background: var(--primary);
          color: var(--primary-contrast);
        }

        .secondaryBtn {
          background: var(--bg);
          color: var(--text);
          border: 1px solid var(--border);
        }

        .summaryGrid {
          padding: 20px;
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .summaryCard {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 16px;
          background: color-mix(in oklab, var(--bg) 70%, var(--primary) 30% / 8%);
          border: 1px solid var(--border);
        }

        .summaryCard strong {
          display: block;
          font-size: 14px;
          color: var(--text);
        }

        .summaryCard span {
          display: block;
          font-size: 12px;
          color: var(--muted);
        }

        .weekGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 18px;
        }

        .dayCard {
          padding: 20px;
        }

        .dayHead {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        .dayHead h2 {
          margin: 0 0 4px;
          font-size: 20px;
        }

        .dayHead p {
          margin: 0;
        }

        .caloriePill {
          padding: 8px 12px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--bg);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }

        .mealList {
          display: grid;
          gap: 10px;
        }

        .mealRow {
          display: flex;
          gap: 10px;
          align-items: flex-start;
          padding: 12px 14px;
          border-radius: 14px;
          background: color-mix(in oklab, var(--bg) 84%, var(--primary) 16% / 8%);
          border: 1px solid var(--border);
          color: var(--text);
          font-size: 14px;
        }

        @media (max-width: 900px) {
          .hero {
            grid-template-columns: 1fr;
          }

          .weekGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .mealPlanPage {
            padding: 20px 16px 28px;
          }

          .heroText,
          .summaryGrid,
          .dayCard {
            border-radius: 20px;
          }

          .heroText {
            padding: 22px;
          }
        }
      `}</style>
    </div>
  );
}
