export type Locale = 'fr' | 'en'

export const dictionaries = {
  fr: {
    common: {
      appName: 'AgriCollect CM',
      dashboard: 'Tableau de bord',
      login: 'Connexion',
      logout: 'Déconnexion',
      loading: 'Chargement...',
      error: 'Une erreur est survenue',
      retry: 'Réessayer',
      save: 'Enregistrer',
      cancel: 'Annuler',
      delete: 'Supprimer',
      actions: 'Actions',
      status: 'Statut',
      date: 'Date',
    },
    auth: {
      welcome: 'Bienvenue sur AgriCollect',
      subtitle: 'Gestion des collectes et paiements GIC',
      email: 'Email',
      password: 'Mot de passe',
      signIn: 'Se connecter',
      forgotPassword: 'Mot de passe oublié ?',
    },
    dashboard: {
      stats: {
        totalDeliveries: 'Total Livraisons',
        totalAmount: 'Montant Total',
        activeProducers: 'Producteurs Actifs',
        campaigns: 'Campagnes Actives',
        netDue: 'Net à payer',
        volumeTotal: 'Volume Total',
      },
      recentActivity: 'Activité Récente',
      noActivity: 'Aucune activité récente',
      sections: {
        overview: 'Aperçu',
        recentDeliveries: 'Livraisons Récentes',
        activeCampaign: 'Campagne Active',
        viewAll: 'Voir tout',
      },
      table: {
        producer: 'Producteur',
        product: 'Produit',
        quantity: 'Quantité',
        amount: 'Montant',
        date: 'Date',
      }
    },
  },
  en: {
    common: {
      appName: 'AgriCollect CM',
      dashboard: 'Dashboard',
      login: 'Login',
      logout: 'Logout',
      loading: 'Loading...',
      error: 'An error occurred',
      retry: 'Retry',
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      actions: 'Actions',
      status: 'Status',
      date: 'Date',
    },
    auth: {
      welcome: 'Welcome to AgriCollect',
      subtitle: 'GIC collection and payment management',
      email: 'Email',
      password: 'Password',
      signIn: 'Sign In',
      forgotPassword: 'Forgot Password?',
    },
    dashboard: {
      stats: {
        totalDeliveries: 'Total Deliveries',
        totalAmount: 'Total Amount',
        activeProducers: 'Active Producers',
        campaigns: 'Active Campaigns',
        netDue: 'Net Due',
        volumeTotal: 'Total Volume',
      },
      recentActivity: 'Recent Activity',
      noActivity: 'No recent activity',
      sections: {
        overview: 'Overview',
        recentDeliveries: 'Recent Deliveries',
        activeCampaign: 'Active Campaign',
        viewAll: 'View all',
      },
      table: {
        producer: 'Producer',
        product: 'Product',
        quantity: 'Quantity',
        amount: 'Amount',
        date: 'Date',
      }
    },
  },
}

export const getDictionary = (locale: Locale) => dictionaries[locale] || dictionaries.fr
